import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDelDia } from '../common/fechas.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { FiltroReviewsDto } from './dto/filtro-reviews.dto.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** RF-09 / RB-05: la review pertenece a un pedido existente, y la deja quien lo hizo. */
  async create(
    id_pedido: number,
    { dni, puntuacion, comentario }: CreateReviewDto,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido #${id_pedido} no encontrado`);
    }
    if (pedido.dni_cliente !== dni) {
      throw new ForbiddenException(
        'Solo quien hizo el pedido puede dejarle una review',
      );
    }
    return this.prisma.review.create({
      data: { id_pedido, puntuacion, comentario: comentario || null },
    });
  }

  async findAll({ desde, hasta }: FiltroReviewsDto) {
    const where = {
      fecha_hora: {
        ...(desde && { gte: rangoDelDia(desde).desde }),
        ...(hasta && { lte: rangoDelDia(hasta).hasta }),
      },
    };

    const [reviews, resumen] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { fecha_hora: 'desc' },
        include: {
          pedido: {
            select: {
              id_pedido: true,
              mesa: { select: { numero_mesa: true } },
              cliente: { select: { dni: true, nombre: true } },
            },
          },
        },
      }),
      this.prisma.review.aggregate({
        where,
        _avg: { puntuacion: true },
        _count: true,
      }),
    ]);

    return {
      promedio: resumen._avg.puntuacion,
      cantidad: resumen._count,
      reviews,
    };
  }
}
