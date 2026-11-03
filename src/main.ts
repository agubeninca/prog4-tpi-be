import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ErroresExceptionFilter } from './errores/errores-exception.filter.js';
import { ErroresService } from './errores/errores.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Un solo mensaje por campo: el primero que falla ("es obligatorio" antes que "mínimo 3").
      stopAtFirstError: true,
    }),
  );
  app.useGlobalFilters(app.get(ErroresExceptionFilter));

  // Errores fuera de un request (ej. una promesa sin catch): también van al log de Firestore.
  const errores = app.get(ErroresService);
  process.on('uncaughtException', (error) => {
    void errores.registrarError({
      tipo_sistema: 'backend',
      mensaje: error.message,
      stack: error.stack ?? null,
      contexto: 'uncaughtException',
    });
  });
  process.on('unhandledRejection', (motivo) => {
    void errores.registrarError({
      tipo_sistema: 'backend',
      mensaje: motivo instanceof Error ? motivo.message : String(motivo),
      stack: motivo instanceof Error ? (motivo.stack ?? null) : null,
      contexto: 'unhandledRejection',
    });
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
