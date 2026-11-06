import {
  ConflictException,
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

  /** RF-09 / RB-05: la review pertenece a un pedido existente, la deja quien lo hizo y es una sola por pedido. */
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
    const yaOpino = await this.prisma.review.findFirst({
      where: { id_pedido },
      select: { id_review: true },
    });
    if (yaOpino) {
      throw new ConflictException('Ya dejaste tu opinión sobre este pedido');
    }
    return this.prisma.review.create({
      data: { id_pedido, puntuacion, comentario: comentario || null },
    });
  }

  async findAll({ desde, hasta, dni }: FiltroReviewsDto) {
    const where = {
      fecha_hora: {
        ...(desde && { gte: rangoDelDia(desde).desde }),
        ...(hasta && { lte: rangoDelDia(hasta).hasta }),
      },
      ...(dni && { pedido: { dni_cliente: dni } }),
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

  /** El admin elimina una review (por ejemplo, un comentario inapropiado). Es un borrado real. */
  async remove(id_review: number) {
    const review = await this.prisma.review.findUnique({
      where: { id_review },
    });
    if (!review) {
      throw new NotFoundException(`Review #${id_review} no encontrada`);
    }
    return this.prisma.review.delete({ where: { id_review } });
  }
}
