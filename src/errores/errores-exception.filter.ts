import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestConUsuario } from '../auth/auth.types.js';
import { ErroresService } from './errores.service.js';

/**
 * Filtro global: traduce los errores conocidos de Prisma a 409/404/400 y registra en Firestore
 * (colección "errores") todo error inesperado (500). Los 4xx son reglas de negocio: no se registran.
 */
@Injectable()
@Catch()
export class ErroresExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErroresExceptionFilter.name);

  constructor(private readonly erroresService: ErroresService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<RequestConUsuario>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const conocido = this.manejarErrorPrisma(exception);
      if (conocido) {
        return response
          .status(conocido.getStatus())
          .json(conocido.getResponse());
      }
    }

    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    const mensaje =
      exception instanceof Error ? exception.message : 'Error desconocido';
    const stack = exception instanceof Error ? (exception.stack ?? null) : null;
    this.logger.error(mensaje, stack ?? undefined);
    await this.erroresService.registrarError({
      tipo_sistema: 'backend',
      mensaje,
      stack,
      contexto: `${request.method} ${request.originalUrl}`,
      usuario: request.user?.nombre_usuario ?? null,
    });

    const error = new InternalServerErrorException(
      'Error interno al procesar la solicitud',
    );
    return response.status(error.getStatus()).json(error.getResponse());
  }

  /** Errores de Prisma que son del usuario (único, inexistente, FK); el resto es inesperado. */
  private manejarErrorPrisma(exception: Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      const campo = Array.isArray(target)
        ? target.map(String).join(', ')
        : typeof target === 'string'
          ? target
          : 'ese valor';
      return new ConflictException(
        `Ya existe un registro con ese valor único (${campo})`,
      );
    }
    if (exception.code === 'P2025') {
      return new NotFoundException('Registro no encontrado');
    }
    if (exception.code === 'P2003') {
      return new BadRequestException(
        'La referencia indicada no existe (foreign key inválida)',
      );
    }
    return null;
  }
}
