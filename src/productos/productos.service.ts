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
        // El nuevo producto va al final de su categoría.
        orden: await this.siguienteOrden(createProductoDto.id_categoria),
      },
      include: INCLUDE_CATEGORIA,
    });
  }

  findAll({ id_categoria }: FiltroProductosDto) {
    return this.prisma.producto.findMany({
      where: { archivado: false, id_categoria },
      orderBy: [
        { categoria: { orden: 'asc' } },
        { orden: 'asc' },
        { nombre: 'asc' },
      ],
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
    const actual = await this.findOne(id);
    const cambiaDeCategoria =
      resto.id_categoria !== undefined &&
      resto.id_categoria !== actual.id_categoria;
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: {
        ...resto,
        ...(cambiaDeCategoria && {
          orden: await this.siguienteOrden(resto.id_categoria!),
        }),
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

  /** Quita la imagen del producto: borra el archivo de Storage y deja el producto sin imagen. */
  async eliminarImagen(id: number) {
    const producto = await this.findOne(id);
    if (producto.ruta_imagen) {
      await this.firebase
        .bucket()
        .file(producto.ruta_imagen)
        .delete({ ignoreNotFound: true });
    }
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { ruta_imagen: null },
      include: INCLUDE_CATEGORIA,
    });
  }

  private async siguienteOrden(id_categoria: number) {
    const { _max } = await this.prisma.producto.aggregate({
      where: { id_categoria, archivado: false },
      _max: { orden: true },
    });
    return (_max.orden ?? 0) + 1;
  }

  /** Orden de los productos de una categoría: el primer id queda en la posición 1. */
  async ordenar(id_categoria: number, ids: number[]) {
    await this.validarCategoria(id_categoria);
    const productos = await this.prisma.producto.findMany({
      where: { id_categoria, archivado: false },
      select: { id_producto: true },
    });
    const existentes = new Set(productos.map((p) => p.id_producto));
    if (
      ids.length !== existentes.size ||
      !ids.every((id) => existentes.has(id))
    ) {
      throw new BadRequestException(
        'La lista tiene que incluir todos los productos de la categoría, sin repetir ni agregar otros',
      );
    }
    await this.prisma.$transaction(
      ids.map((id_producto, indice) =>
        this.prisma.producto.update({
          where: { id_producto },
          data: { orden: indice + 1 },
        }),
      ),
    );
    return this.findAll({ id_categoria });
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
