import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { ClientesService } from './clientes.service.js';
import { IdentificarClienteDto } from './dto/identificar-cliente.dto.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Public()
  @Post('identificar')
  @HttpCode(HttpStatus.OK)
  identificar(@Body() identificarClienteDto: IdentificarClienteDto) {
    return this.clientesService.identificar(identificarClienteDto);
  }
}
