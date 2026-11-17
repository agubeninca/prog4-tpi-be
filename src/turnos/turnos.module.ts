import { Module } from '@nestjs/common';
import { ReportesModule } from '../reportes/reportes.module.js';
import { TurnosController } from './turnos.controller.js';
import { TurnosService } from './turnos.service.js';

@Module({
  imports: [ReportesModule],
  controllers: [TurnosController],
  providers: [TurnosService],
})
export class TurnosModule {}
