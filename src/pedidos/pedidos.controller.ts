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
import { Public, Roles, UsuarioActual } from '../auth/decorators.js';
import type { UsuarioAutenticado } from '../auth/auth.types.js';
import { PedidosService } from './pedidos.service.js';
import { CreatePedidoDto } from './dto/create-pedido.dto.js';
import { CreatePedidoManualDto } from './dto/create-pedido-manual.dto.js';
import { FiltroRegistroManualDto } from './dto/filtro-registro-manual.dto.js';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto.js';
import { CambiarPagoPedidoDto } from './dto/cambiar-pago-pedido.dto.js';
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

  /** La Barra carga una comanda a mano (clientes que no escanean el QR). */
  @Roles('ADMIN', 'BARRA')
  @Post('manual')
  createManual(
    @Body() createPedidoManualDto: CreatePedidoManualDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidosService.createManual(createPedidoManualDto, usuario);
  }

  @Roles('ADMIN', 'BARRA', 'COCINA')
  @Get()
  findAll(@Query() filtro: FiltroPedidosDto) {
    return this.pedidosService.findAll(filtro);
  }

  // Va antes de GET :id para que "manuales" no se tome como un id.
  /** Registro de comandas cargadas a mano: horario, comanda y quién la cargó. */
  @Roles('ADMIN', 'BARRA')
  @Get('manuales')
  findRegistroManual(@Query() filtro: FiltroRegistroManualDto) {
    return this.pedidosService.findRegistroManual(filtro);
  }

  @Public()
  @Get(':id')
  findOneParaCliente(
    @Param('id', ParseIntPipe) id: number,
    @Query() { dni }: ConsultaPedidoClienteDto,
  ) {
    return this.pedidosService.findOneParaCliente(id, dni);
  }

  /** RF-06: transición de estado desde la Barra (Cocina solo visualiza). */
  @Roles('ADMIN', 'BARRA')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoPedidoDto: CambiarEstadoPedidoDto,
  ) {
    return this.pedidosService.cambiarEstado(id, cambiarEstadoPedidoDto);
  }

  /** La barra (o el admin) marca el pedido como pagado o pendiente de pago. */
  @Roles('ADMIN', 'BARRA')
  @Patch(':id/pago')
  cambiarPago(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarPagoPedidoDto: CambiarPagoPedidoDto,
  ) {
    return this.pedidosService.cambiarPago(id, cambiarPagoPedidoDto);
  }
}
