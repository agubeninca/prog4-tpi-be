import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { ClientesService } from './clientes.service.js';
import { IdentificarClienteDto } from './dto/identificar-cliente.dto.js';
import { FiltroClientesDto } from './dto/filtro-clientes.dto.js';
import { DniParamDto } from './dto/dni-param.dto.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

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
}
