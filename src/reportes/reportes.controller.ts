import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { ReportesService } from './reportes.service.js';
import { FiltroVentasDiaDto } from './dto/filtro-ventas-dia.dto.js';

@Controller('reportes')
@Roles('ADMIN')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ventas-dia')
  ventasDelDia(@Query() { fecha }: FiltroVentasDiaDto) {
    return this.reportesService.ventasDelDia(fecha);
  }
}
