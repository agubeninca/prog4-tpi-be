import { Module } from '@nestjs/common';
import { PedidosService } from './pedidos.service.js';
import { PedidosController } from './pedidos.controller.js';
import { ComandasService } from './comandas.service.js';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, ComandasService],
})
export class PedidosModule {}
