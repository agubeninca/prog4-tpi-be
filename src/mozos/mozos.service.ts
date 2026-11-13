import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMozoDto } from './dto/create-mozo.dto.js';
import { UpdateMozoDto } from './dto/update-mozo.dto.js';
import { mozosPorMesa } from './mesas-atendidas.js';

@Injectable()
export class MozosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mozos (activos e inactivos) con las mesas que atienden ahora. */
  async findAll() {
    const [mozos, atendidas] = await Promise.all([
      this.prisma.mozo.findMany({
        where: { archivado: false },
        orderBy: { nombre: 'asc' },
      }),
      mozosPorMesa(this.prisma),
    ]);
    return mozos.map((mozo) => ({
      ...mozo,
      mesas_atendiendo: [...atendidas.values()]
        .filter((mesa) => mesa.id_mozo === mozo.id_mozo)
        .map((mesa) => mesa.numero_mesa)
        .sort((a, b) => a - b),
    }));
  }

  async create({ nombre, activo }: CreateMozoDto) {
    const existente = await this.prisma.mozo.findUnique({ where: { nombre } });
    if (existente && !existente.archivado) {
      throw new ConflictException(`Ya hay un mozo llamado "${nombre}"`);
    }
    // El nombre es único: si había uno eliminado con ese nombre, se lo recupera.
    if (existente) {
      return this.prisma.mozo.update({
        where: { id_mozo: existente.id_mozo },
        data: { archivado: false, activo: activo ?? true },
      });
    }
    return this.prisma.mozo.create({ data: { nombre, activo } });
  }

  async update(id: number, { nombre, activo }: UpdateMozoDto) {
    await this.findOne(id);
    if (nombre !== undefined) {
      const otro = await this.prisma.mozo.findUnique({ where: { nombre } });
      if (otro && otro.id_mozo !== id) {
        throw new ConflictException(
          otro.archivado
            ? `"${nombre}" es el nombre de un mozo eliminado: volvé a agregarlo desde "Nuevo mozo"`
            : `Ya hay un mozo llamado "${nombre}"`,
        );
      }
    }
    if (activo === false) {
      await this.verificarSinMesas(id, 'desactivarlo');
    }
    return this.prisma.mozo.update({
      where: { id_mozo: id },
      data: { nombre, activo },
    });
  }

  /** Se archiva (no se borra): sus pedidos anteriores siguen mostrando quién los atendió. */
  async remove(id: number) {
    await this.findOne(id);
    await this.verificarSinMesas(id, 'eliminarlo');
    return this.prisma.mozo.update({
      where: { id_mozo: id },
      data: { archivado: true, activo: false },
    });
  }

  private async findOne(id: number) {
    const mozo = await this.prisma.mozo.findFirst({
      where: { id_mozo: id, archivado: false },
    });
    if (!mozo) {
      throw new NotFoundException(`Mozo #${id} no encontrado`);
    }
    return mozo;
  }

  private async verificarSinMesas(id: number, accion: string) {
    const mesas = [
      ...(await mozosPorMesa(this.prisma, { id_mozo: id })).values(),
    ]
      .map((mesa) => mesa.numero_mesa)
      .sort((a, b) => a - b);
    if (mesas.length > 0) {
      throw new ConflictException(
        `No se puede ${accion}: está atendiendo ${
          mesas.length === 1 ? 'la mesa' : 'las mesas'
        } ${mesas.join(', ')}. Se libera cuando sus pedidos estén pagados o cancelados`,
      );
    }
  }
}
