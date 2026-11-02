import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { ClientesService } from './clientes.service.js';
import { IdentificarClienteDto } from './dto/identificar-cliente.dto.js';
import { FiltroClientesDto } from './dto/filtro-clientes.dto.js';
import { DniParamDto } from './dto/dni-param.dto.js';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  /** Vista Cliente: al terminar de escribir el DNI, antes de pedir el nombre. */
  @Public()
  @Get('consulta/:dni')
  consultar(@Param() { dni }: DniParamDto) {
    return this.clientesService.consultar(dni);
  }

  @Public()
  @Post('identificar')
  @HttpCode(HttpStatus.OK)
  identificar(@Body() identificarClienteDto: IdentificarClienteDto) {
    return this.clientesService.identificar(identificarClienteDto);
  }

  @Roles('ADMIN')
  @Get()
  findAll(@Query() filtro: FiltroClientesDto) {
    return this.clientesService.findAll(filtro);
  }

  @Roles('ADMIN')
  @Get(':dni')
  findOne(@Param() { dni }: DniParamDto) {
    return this.clientesService.findOne(dni);
  }

  @Roles('ADMIN')
  @Patch(':dni')
  actualizar(
    @Param() { dni }: DniParamDto,
    @Body() actualizarClienteDto: ActualizarClienteDto,
  ) {
    return this.clientesService.actualizar(dni, actualizarClienteDto);
  }

  @Roles('ADMIN')
  @Delete(':dni')
  remove(@Param() { dni }: DniParamDto) {
    return this.clientesService.remove(dni);
  }
}
