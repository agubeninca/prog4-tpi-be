import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { pedido_estado } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { INCLUDE_PEDIDO } from '../pedidos/pedido.include.js';
import { IdentificarClienteDto } from './dto/identificar-cliente.dto.js';
import { FiltroClientesDto } from './dto/filtro-clientes.dto.js';

/** Promedio con un decimal, o null si no hay valores. */
function promedio(valores: number[]) {
  if (valores.length === 0) return null;
  return Number(
    (
      valores.reduce((total, valor) => total + valor, 0) / valores.length
    ).toFixed(1),
  );
}

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

  /** Listado para el panel, con métricas de pedidos y reviews de cada cliente. */
  async findAll({ q }: FiltroClientesDto) {
    const clientes = await this.prisma.cliente.findMany({
      where: q
        ? { OR: [{ dni: { contains: q } }, { nombre: { contains: q } }] }
        : undefined,
      orderBy: { fecha_actualizacion: 'desc' },
      take: 500,
    });
    const dnis = clientes.map((cliente) => cliente.dni);
    if (dnis.length === 0) return [];

    const [pedidos, servidos, reviews] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['dni_cliente'],
        where: { dni_cliente: { in: dnis } },
        _count: { _all: true },
        _max: { fecha_hora_ingreso: true },
      }),
      this.prisma.pedido.groupBy({
        by: ['dni_cliente'],
        where: { dni_cliente: { in: dnis }, estado: pedido_estado.SERVIDO },
        _sum: { precio_total: true },
      }),
      this.prisma.review.findMany({
        where: { pedido: { dni_cliente: { in: dnis } } },
        select: { puntuacion: true, pedido: { select: { dni_cliente: true } } },
      }),
    ]);

    return clientes.map((cliente) => {
      const delCliente = pedidos.find((p) => p.dni_cliente === cliente.dni);
      const gasto = servidos.find((p) => p.dni_cliente === cliente.dni);
      const puntuaciones = reviews
        .filter((review) => review.pedido.dni_cliente === cliente.dni)
        .map((review) => review.puntuacion);
      return {
        ...cliente,
        cantidad_pedidos: delCliente?._count._all ?? 0,
        // Igual que el resumen de ventas (RF-08): solo cuentan los pedidos servidos.
        total_gastado: (gasto?._sum.precio_total ?? 0).toFixed(2),
        ultima_visita: delCliente?._max.fecha_hora_ingreso ?? null,
        cantidad_reviews: puntuaciones.length,
        promedio_puntuacion: promedio(puntuaciones),
      };
    });
  }

  /** Ficha de un cliente: datos, métricas, historial de pedidos y reviews. */
  async findOne(dni: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { dni } });
    if (!cliente) {
      throw new NotFoundException(`No hay un cliente con DNI ${dni}`);
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: { dni_cliente: dni },
      orderBy: { fecha_hora_ingreso: 'desc' },
      include: {
        ...INCLUDE_PEDIDO,
        review: { orderBy: { fecha_hora: 'desc' } },
      },
    });

    const cantidadPorEstado = Object.fromEntries(
      Object.values(pedido_estado).map((estado) => [
        estado,
        pedidos.filter((pedido) => pedido.estado === estado).length,
      ]),
    ) as Record<pedido_estado, number>;

    const servidos = pedidos.filter(
      (pedido) => pedido.estado === pedido_estado.SERVIDO,
    );
    const totalGastado = servidos.reduce(
      (total, pedido) => total.plus(pedido.precio_total.toString()),
      new Decimal(0),
    );

    // Producto favorito: el que más unidades pidió (sin contar pedidos cancelados).
    const unidadesPorProducto = new Map<string, number>();
    for (const pedido of pedidos) {
      if (pedido.estado === pedido_estado.CANCELADO) continue;
      for (const detalle of pedido.detalle_pedido) {
        const nombre = detalle.producto.nombre;
        unidadesPorProducto.set(
          nombre,
          (unidadesPorProducto.get(nombre) ?? 0) + detalle.cantidad,
        );
      }
    }
    const [favorito] = [...unidadesPorProducto].sort((a, b) => b[1] - a[1]);

    const reviews = pedidos.flatMap((pedido) =>
      pedido.review.map((review) => ({
        ...review,
        numero_mesa: pedido.mesa.numero_mesa,
      })),
    );

    return {
      ...cliente,
      metricas: {
        cantidad_pedidos: pedidos.length,
        cantidad_por_estado: cantidadPorEstado,
        total_gastado: totalGastado.toFixed(2),
        ticket_promedio:
          servidos.length > 0
            ? totalGastado.dividedBy(servidos.length).toFixed(2)
            : null,
        primera_visita: pedidos.at(-1)?.fecha_hora_ingreso ?? null,
        ultima_visita: pedidos[0]?.fecha_hora_ingreso ?? null,
        cantidad_reviews: reviews.length,
        promedio_puntuacion: promedio(
          reviews.map((review) => review.puntuacion),
        ),
        producto_favorito: favorito
          ? { nombre: favorito[0], unidades: favorito[1] }
          : null,
      },
      pedidos,
      reviews,
    };
  }
}
