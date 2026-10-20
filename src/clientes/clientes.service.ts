import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IdentificarClienteDto } from './dto/identificar-cliente.dto.js';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /** RB-04: el DNI + nombre generan o actualizan el registro del cliente. */
  identificar({ dni, nombre }: IdentificarClienteDto) {
    return this.prisma.cliente.upsert({
      where: { dni },
      update: { nombre },
      create: { dni, nombre },
    });
  }
}
