import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { ErroresService } from './errores.service.js';
import { RegistrarErrorDto } from './dto/registrar-error.dto.js';
import { FiltroErroresDto } from './dto/filtro-errores.dto.js';

const LIMITE_POR_DEFECTO = 100;

@Controller('errores')
export class ErroresController {
  constructor(private readonly erroresService: ErroresService) {}

  /** El frontend reporta sus errores acá (público: también la Vista Cliente). */
  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async registrar(
    @Body() { mensaje, stack, contexto }: RegistrarErrorDto,
    @Headers('user-agent') navegador?: string,
  ) {
    await this.erroresService.registrarError({
      tipo_sistema: 'frontend',
      mensaje,
      stack,
      contexto,
      navegador: navegador?.slice(0, 300),
    });
    return { registrado: true };
  }

  @Roles('ADMIN')
  @Get()
  listar(@Query() { tipo, limite }: FiltroErroresDto) {
    return this.erroresService.listar(tipo, limite ?? LIMITE_POR_DEFECTO);
  }

  /** Botón "Probar" del panel: genera un error de backend no controlado (lo captura el filtro global). */
  @Roles('ADMIN')
  @Get('prueba')
  probar(): never {
    throw new Error('Error de prueba del backend (botón "Probar" del panel)');
  }

  @Roles('ADMIN')
  @Delete()
  vaciar() {
    return this.erroresService.vaciar();
  }
}
