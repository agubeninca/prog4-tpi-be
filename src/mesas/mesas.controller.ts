import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { MesasService } from './mesas.service.js';
import { CreateMesaDto } from './dto/create-mesa.dto.js';
import { UpdateMesaDto } from './dto/update-mesa.dto.js';

@Controller('mesas')
@Roles('ADMIN')
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  /** RF-02: la Vista Cliente identifica la mesa a partir del QR escaneado. */
  @Public()
  @Get('qr/:hash')
  buscarPorHash(@Param('hash') hash: string) {
    return this.mesasService.buscarPorHash(hash);
  }

  @Post()
  create(@Body() createMesaDto: CreateMesaDto) {
    return this.mesasService.create(createMesaDto);
  }

  @Get()
  findAll() {
    return this.mesasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMesaDto: UpdateMesaDto,
  ) {
    return this.mesasService.update(id, updateMesaDto);
  }

  @Post(':id/regenerar-qr')
  regenerarQr(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.regenerarQr(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.remove(id);
  }
}
