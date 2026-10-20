import {
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

  create(createCategoriaDto: CreateCategoriaDto) {
    return this.prisma.categoria.create({ data: createCategoriaDto });
  }

  findAll() {
    return this.prisma.categoria.findMany({
      where: { archivado: false },
      orderBy: { nombre: 'asc' },
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
