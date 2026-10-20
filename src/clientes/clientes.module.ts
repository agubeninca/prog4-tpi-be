import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import { ClientesController } from './clientes.controller.js';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}
