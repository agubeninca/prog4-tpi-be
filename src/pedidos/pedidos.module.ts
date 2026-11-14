import { Module } from '@nestjs/common';
import { PedidosService } from './pedidos.service.js';
import { PedidosController } from './pedidos.controller.js';
import { ComandasService } from './comandas.service.js';
import { PedidosEventosService } from './pedidos-eventos.service.js';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, ComandasService, PedidosEventosService],
})
export class PedidosModule {}
