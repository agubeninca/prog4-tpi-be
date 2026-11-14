import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoriaDto } from './dto/create-categoria.dto.js';
import { UpdateCategoriaDto } from './dto/update-categoria.dto.js';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoriaDto: CreateCategoriaDto) {
    // La nueva categoría va al final del menú.
    const { _max } = await this.prisma.categoria.aggregate({
      _max: { orden: true },
    });
    return this.prisma.categoria.create({
      data: { ...createCategoriaDto, orden: (_max.orden ?? 0) + 1 },
    });
  }

  /** Fija el orden del menú: el primer id queda en la posición 1. Tienen que estar todas las categorías. */
  async ordenar(ids: number[]) {
    const categorias = await this.prisma.categoria.findMany({
      where: { archivado: false },
      select: { id_categoria: true },
    });
    const existentes = new Set(categorias.map((c) => c.id_categoria));
    if (
      ids.length !== existentes.size ||
      !ids.every((id) => existentes.has(id))
    ) {
      throw new BadRequestException(
        'La lista tiene que incluir todas las categorías, sin repetir ni agregar otras',
      );
    }
    await this.prisma.$transaction(
      ids.map((id_categoria, indice) =>
        this.prisma.categoria.update({
          where: { id_categoria },
          data: { orden: indice + 1 },
        }),
      ),
    );
    return this.findAll();
  }

  findAll() {
    return this.prisma.categoria.findMany({
      where: { archivado: false },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        _count: { select: { producto: { where: { archivado: false } } } },
      },
    });
  }

  async findOne(id: number) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id_categoria: id, archivado: false },
    });
    if (!categoria) {
      throw new NotFoundException(`Categoría #${id} no encontrada`);
    }
    return categoria;
  }

  async update(id: number, updateCategoriaDto: UpdateCategoriaDto) {
    await this.findOne(id);
    return this.prisma.categoria.update({
      where: { id_categoria: id },
      data: updateCategoriaDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    const productosActivos = await this.prisma.producto.count({
      where: { id_categoria: id, archivado: false },
    });
    if (productosActivos > 0) {
      throw new ConflictException(
        `La categoría tiene ${productosActivos} producto(s) activo(s). Movelos o eliminalos primero`,
      );
    }
    return this.prisma.categoria.update({
      where: { id_categoria: id },
      data: { archivado: true },
    });
  }
}
