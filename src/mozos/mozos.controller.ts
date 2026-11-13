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
import { Roles } from '../auth/decorators.js';
import { CreateMozoDto } from './dto/create-mozo.dto.js';
import { UpdateMozoDto } from './dto/update-mozo.dto.js';
import { MozosService } from './mozos.service.js';

@Controller('mozos')
@Roles('ADMIN')
export class MozosController {
  constructor(private readonly mozosService: MozosService) {}

  /** La Barra también los lista: elige el mozo al cargar una comanda a mano. */
  @Roles('ADMIN', 'BARRA')
  @Get()
  findAll() {
    return this.mozosService.findAll();
  }

  @Post()
  create(@Body() createMozoDto: CreateMozoDto) {
    return this.mozosService.create(createMozoDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMozoDto: UpdateMozoDto,
  ) {
    return this.mozosService.update(id, updateMozoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.mozosService.remove(id);
  }
}
