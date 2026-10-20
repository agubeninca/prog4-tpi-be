import { Module } from '@nestjs/common';
import { MesasService } from './mesas.service.js';
import { MesasController } from './mesas.controller.js';

@Module({
  controllers: [MesasController],
  providers: [MesasService],
})
export class MesasModule {}
