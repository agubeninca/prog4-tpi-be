import { Global, Module } from '@nestjs/common';
import { ErroresService } from './errores.service.js';
import { ErroresController } from './errores.controller.js';
import { ErroresExceptionFilter } from './errores-exception.filter.js';

// Global: cualquier módulo puede inyectar ErroresService para registrar un error.
@Global()
@Module({
  controllers: [ErroresController],
  providers: [ErroresService, ErroresExceptionFilter],
  exports: [ErroresService, ErroresExceptionFilter],
})
export class ErroresModule {}
