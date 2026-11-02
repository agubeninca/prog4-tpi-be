import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { pedido_estado, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { INCLUDE_PEDIDO } from '../pedidos/pedido.include.js';
import { IdentificarClienteDto } from './dto/identificar-cliente.dto.js';
import { FiltroClientesDto } from './dto/filtro-clientes.dto.js';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto.js';

/** Promedio con un decimal, o null si no hay valores. */
function promedio(valores: number[]) {
  if (valores.length === 0) return null;
  return Number(
    (
      valores.reduce((total, valor) => total + valor, 0) / valores.length
    ).toFixed(1),
  );
}

/**
 * "Agustín Beninca" → "A*** B***": alcanza para que la persona se reconozca
 * sin exponer el nombre de otros a quien pruebe DNIs (largo fijo, no revela cuántas letras tiene).
 */
export function enmascararNombre(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => `${palabra.charAt(0).toUpperCase()}***`)
    .join(' ');
}

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Antes de pedir el nombre: ¿el DNI ya está registrado? (público, con el nombre enmascarado). */
  async consultar(dni: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { dni } });
    return cliente
      ? {
          registrado: true,
          nombre_enmascarado: enmascararNombre(cliente.nombre),
        }
      : { registrado: false, nombre_enmascarado: null };
  }

  /**
   * RB-04: el DNI + nombre generan el registro del cliente. Si el DNI ya existe, la persona confirmó
   * que es ella ("¿Sos A*** B***?") y el nombre NO se pisa ni se devuelve: desde la mesa no se puede
   * cambiar ni averiguar el nombre de otro. El admin lo corrige con PATCH /clientes/:dni.
   */
  async identificar({ dni, nombre }: IdentificarClienteDto) {
    const existente = await this.prisma.cliente.findUnique({ where: { dni } });
    if (existente) {
      return { dni, nombre: null, registrado: true };
    }
    if (!nombre) {
      throw new BadRequestException('El nombre y apellido es obligatorio');
    }
    const nuevo = await this.prisma.cliente.create({ data: { dni, nombre } });
    return { dni: nuevo.dni, nombre: nuevo.nombre, registrado: false };
  }

  /** El admin corrige el nombre (por ejemplo, si la persona lo escribió mal la primera vez). */
  async actualizar(dni: string, { nombre }: ActualizarClienteDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { dni } });
    if (!cliente) {
      throw new NotFoundException(`No hay un cliente con DNI ${dni}`);
    }
    return this.prisma.cliente.update({ where: { dni }, data: { nombre } });
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

  /**
   * Elimina un cliente sin pedidos (ej. un DNI mal tipeado). Si tiene pedidos no se borra:
   * son parte del historial de ventas (RF-08), de las reviews y del resumen.
   */
  async remove(dni: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { dni } });
    if (!cliente) {
      throw new NotFoundException(`No hay un cliente con DNI ${dni}`);
    }
    const pedidos = await this.prisma.pedido.count({
      where: { dni_cliente: dni },
    });
    if (pedidos > 0) {
      throw new ConflictException(
        `No se puede eliminar: el cliente tiene ${pedidos} pedido(s), que forman parte del historial de ventas`,
      );
    }
    try {
      return await this.prisma.cliente.delete({ where: { dni } });
    } catch (error) {
      // Hizo un pedido justo entre el conteo y el borrado: la FK de pedido lo impide.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar: el cliente acaba de hacer un pedido',
        );
      }
      throw error;
    }
  }
}
