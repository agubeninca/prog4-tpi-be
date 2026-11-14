import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators.js';
import { ProductosService } from './productos.service.js';
import { CreateProductoDto } from './dto/create-producto.dto.js';
import { UpdateProductoDto } from './dto/update-producto.dto.js';
import { PausaProductoDto } from './dto/pausa-producto.dto.js';
import { FiltroProductosDto } from './dto/filtro-productos.dto.js';
import { OrdenProductosDto } from './dto/orden-productos.dto.js';

@Controller('productos')
@Roles('ADMIN')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  create(@Body() createProductoDto: CreateProductoDto) {
    return this.productosService.create(createProductoDto);
  }

  @Get()
  findAll(@Query() filtro: FiltroProductosDto) {
    return this.productosService.findAll(filtro);
  }

  /** Orden de los productos dentro de una categoría. */
  @Put('orden')
  ordenar(@Body() { id_categoria, ids }: OrdenProductosDto) {
    return this.productosService.ordenar(id_categoria, ids);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, updateProductoDto);
  }

  @Patch(':id/pausa')
  pausar(
    @Param('id', ParseIntPipe) id: number,
    @Body() { estado_pausado }: PausaProductoDto,
  ) {
    return this.productosService.pausar(id, estado_pausado);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(id);
  }

  @Post(':id/imagen')
  @UseInterceptors(FileInterceptor('imagen'))
  actualizarImagen(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpe?g|png|webp|gif)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    imagen: Express.Multer.File,
  ) {
    return this.productosService.actualizarImagen(id, imagen.buffer);
  }

  @Delete(':id/imagen')
  eliminarImagen(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.eliminarImagen(id);
  }
}
