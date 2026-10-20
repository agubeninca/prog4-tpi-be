import { Injectable } from '@nestjs/common';
import { pedido_estado } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDelDia } from '../common/fechas.js';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /** RF-08: total vendido en el día = suma de los pedidos SERVIDO. */
  async ventasDelDia(fechaConsulta?: string) {
    const { fecha, desde, hasta } = rangoDelDia(fechaConsulta);
    const delDia = { fecha_hora_ingreso: { gte: desde, lte: hasta } };

    const [servidos, porEstado] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: { ...delDia, estado: pedido_estado.SERVIDO },
        _sum: { precio_total: true },
        _count: true,
      }),
      this.prisma.pedido.groupBy({
        by: ['estado'],
        where: delDia,
        _count: true,
      }),
    ]);

    const cantidad_por_estado = Object.fromEntries(
      Object.values(pedido_estado).map((estado) => [
        estado,
        porEstado.find((grupo) => grupo.estado === estado)?._count ?? 0,
      ]),
    ) as Record<pedido_estado, number>;

    return {
      fecha,
      total: (servidos._sum.precio_total ?? 0).toFixed(2),
      cantidad_pedidos: servidos._count,
      cantidad_por_estado,
    };
  }
}
