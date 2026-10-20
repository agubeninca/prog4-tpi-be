import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { CreateProductoDto } from './dto/create-producto.dto.js';
import { UpdateProductoDto } from './dto/update-producto.dto.js';
import { FiltroProductosDto } from './dto/filtro-productos.dto.js';

const INCLUDE_CATEGORIA = {
  categoria: { select: { id_categoria: true, nombre: true } },
};

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async create(createProductoDto: CreateProductoDto) {
    await this.validarCategoria(createProductoDto.id_categoria);
    return this.prisma.producto.create({
      data: {
        ...createProductoDto,
        precio: new Decimal(createProductoDto.precio).toFixed(2),
      },
      include: INCLUDE_CATEGORIA,
    });
  }

  findAll({ id_categoria }: FiltroProductosDto) {
    return this.prisma.producto.findMany({
      where: { archivado: false, id_categoria },
      orderBy: [{ categoria: { nombre: 'asc' } }, { nombre: 'asc' }],
      include: INCLUDE_CATEGORIA,
    });
  }

  async findOne(id: number) {
    const producto = await this.prisma.producto.findFirst({
      where: { id_producto: id, archivado: false },
      include: INCLUDE_CATEGORIA,
    });
    if (!producto) {
      throw new NotFoundException(`Producto #${id} no encontrado`);
    }
    return producto;
  }

  async update(id: number, updateProductoDto: UpdateProductoDto) {
    await this.findOne(id);
    if (updateProductoDto.id_categoria !== undefined) {
      await this.validarCategoria(updateProductoDto.id_categoria);
    }
    const { precio, ...resto } = updateProductoDto;
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: {
        ...resto,
        ...(precio !== undefined && { precio: new Decimal(precio).toFixed(2) }),
      },
      include: INCLUDE_CATEGORIA,
    });
  }

  async pausar(id: number, estado_pausado: boolean) {
    await this.findOne(id);
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { estado_pausado },
      include: INCLUDE_CATEGORIA,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { archivado: true },
    });
  }

  async actualizarImagen(id: number, buffer: Buffer) {
    await this.findOne(id);
    const ruta_imagen = `productos/producto-${id}.webp`;

    const bufferWebp = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException(
          'El archivo no es una imagen válida o está dañado',
        );
      });

    await this.firebase
      .bucket()
      .file(ruta_imagen)
      .save(bufferWebp, { contentType: 'image/webp' });

    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { ruta_imagen },
      include: INCLUDE_CATEGORIA,
    });
  }

  private async validarCategoria(id_categoria: number) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id_categoria, archivado: false },
    });
    if (!categoria) {
      throw new BadRequestException('La categoría indicada no existe');
    }
  }
}
