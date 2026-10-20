import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { PedidosService } from './pedidos.service.js';
import { CreatePedidoDto } from './dto/create-pedido.dto.js';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto.js';
import { FiltroPedidosDto } from './dto/filtro-pedidos.dto.js';
import { ConsultaPedidoClienteDto } from './dto/consulta-pedido-cliente.dto.js';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  /** RF-04: el cliente confirma su comanda desde la mesa. */
  @Public()
  @Post()
  create(@Body() createPedidoDto: CreatePedidoDto) {
    return this.pedidosService.create(createPedidoDto);
  }

  @Roles('ADMIN', 'COCINA')
  @Get()
  findAll(@Query() filtro: FiltroPedidosDto) {
    return this.pedidosService.findAll(filtro);
  }

  @Public()
  @Get(':id')
  findOneParaCliente(
    @Param('id', ParseIntPipe) id: number,
    @Query() { dni }: ConsultaPedidoClienteDto,
  ) {
    return this.pedidosService.findOneParaCliente(id, dni);
  }

  /** RF-06: transición de estado desde Cocina/Barra. */
  @Roles('ADMIN', 'COCINA')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoPedidoDto: CambiarEstadoPedidoDto,
  ) {
    return this.pedidosService.cambiarEstado(id, cambiarEstadoPedidoDto);
  }
}
