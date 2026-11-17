import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/auth.types.js';
import { Roles, UsuarioActual } from '../auth/decorators.js';
import { AbrirTurnoDto } from './dto/abrir-turno.dto.js';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto.js';
import { FiltroTurnosDto } from './dto/filtro-turnos.dto.js';
import { TurnosService } from './turnos.service.js';

/** Turnos de caja: los abre y cierra la Barra (y el admin). */
@Controller('turnos')
@Roles('ADMIN', 'BARRA')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  /** Turno abierto con su resumen en vivo (null si no hay ninguno). */
  @Get('actual')
  actual() {
    return this.turnosService.actual();
  }

  @Post('abrir')
  abrir(
    @Body() dto: AbrirTurnoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.turnosService.abrir(dto, usuario);
  }

  @Post('cerrar')
  cerrar(
    @Body() dto: CerrarTurnoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.turnosService.cerrar(dto, usuario);
  }

  @Get()
  historial(@Query() filtro: FiltroTurnosDto) {
    return this.turnosService.historial(filtro);
  }
}
