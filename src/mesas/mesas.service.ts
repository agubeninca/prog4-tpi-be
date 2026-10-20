import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMesaDto } from './dto/create-mesa.dto.js';
import { UpdateMesaDto } from './dto/update-mesa.dto.js';

/** Token aleatorio de 32 caracteres hex: no se puede deducir del número de mesa. */
function generarHashQr() {
  return randomBytes(16).toString('hex');
}

@Injectable()
export class MesasService {
  constructor(private readonly prisma: PrismaService) {}

  async create({ numero_mesa, activa }: CreateMesaDto) {
    // numero_mesa es único: si había una mesa archivada con ese número, se recupera
    // con un QR nuevo (el impreso anteriormente queda invalidado).
    const archivada = await this.prisma.mesa.findFirst({
      where: { numero_mesa, archivado: true },
    });
    if (archivada) {
      return this.prisma.mesa.update({
        where: { id_mesa: archivada.id_mesa },
        data: {
          archivado: false,
          activa: activa ?? true,
          hash_codigo_qr: generarHashQr(),
        },
      });
    }
    return this.prisma.mesa.create({
      data: { numero_mesa, activa, hash_codigo_qr: generarHashQr() },
    });
  }

  findAll() {
    return this.prisma.mesa.findMany({
      where: { archivado: false },
      orderBy: { numero_mesa: 'asc' },
    });
  }

  async findOne(id: number) {
    const mesa = await this.prisma.mesa.findFirst({
      where: { id_mesa: id, archivado: false },
    });
    if (!mesa) {
      throw new NotFoundException(`Mesa #${id} no encontrada`);
    }
    return mesa;
  }

  async buscarPorHash(hash_codigo_qr: string) {
    const mesa = await this.prisma.mesa.findFirst({
      where: { hash_codigo_qr, activa: true, archivado: false },
      select: { id_mesa: true, numero_mesa: true },
    });
    if (!mesa) {
      throw new NotFoundException('Mesa no encontrada o inactiva');
    }
    return mesa;
  }

  async update(id: number, updateMesaDto: UpdateMesaDto) {
    await this.findOne(id);
    return this.prisma.mesa.update({
      where: { id_mesa: id },
      data: updateMesaDto,
    });
  }

  async regenerarQr(id: number) {
    await this.findOne(id);
    return this.prisma.mesa.update({
      where: { id_mesa: id },
      data: { hash_codigo_qr: generarHashQr() },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.mesa.update({
      where: { id_mesa: id },
      data: { archivado: true },
    });
  }
}
