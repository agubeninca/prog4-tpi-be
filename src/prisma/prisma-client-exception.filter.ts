import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

@Catch()
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.manejarErrorPrisma(exception, response);
    }

    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      exception instanceof Error ? exception.message : 'Error desconocido',
      stack,
    );
    const error = new InternalServerErrorException(
      'Error interno al procesar la solicitud',
    );
    return response.status(error.getStatus()).json(error.getResponse());
  }

  private manejarErrorPrisma(
    exception: Prisma.PrismaClientKnownRequestError,
    response: Response,
  ) {
    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      const campo = Array.isArray(target)
        ? target.map(String).join(', ')
        : typeof target === 'string'
          ? target
          : 'ese valor';
      const error = new ConflictException(
        `Ya existe un registro con ese valor único (${campo})`,
      );
      return response.status(error.getStatus()).json(error.getResponse());
    }

    if (exception.code === 'P2025') {
      const error = new NotFoundException('Registro no encontrado');
      return response.status(error.getStatus()).json(error.getResponse());
    }

    if (exception.code === 'P2003') {
      const error = new BadRequestException(
        'La referencia indicada no existe (foreign key inválida)',
      );
      return response.status(error.getStatus()).json(error.getResponse());
    }

    this.logger.error(exception.message, exception.stack);
    const error = new InternalServerErrorException(
      'Error interno al procesar la solicitud',
    );
    return response.status(error.getStatus()).json(error.getResponse());
  }
}
