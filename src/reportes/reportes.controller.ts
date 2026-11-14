import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { ReportesService } from './reportes.service.js';
import { FiltroVentasDiaDto } from './dto/filtro-ventas-dia.dto.js';
import { FiltroEstadisticasDto } from './dto/filtro-estadisticas.dto.js';

@Controller('reportes')
@Roles('ADMIN')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ventas-dia')
  ventasDelDia(@Query() { fecha }: FiltroVentasDiaDto) {
    return this.reportesService.ventasDelDia(fecha);
  }

  /** Cierre de caja: lo hace la Barra al terminar el turno (y el admin). */
  @Roles('ADMIN', 'BARRA')
  @Get('cierre-caja')
  cierreDeCaja(@Query() { fecha }: FiltroVentasDiaDto) {
    return this.reportesService.cierreDeCaja(fecha);
  }

  @Get('estadisticas')
  estadisticas(@Query() { dias }: FiltroEstadisticasDto) {
    return this.reportesService.estadisticas(dias);
  }
}
