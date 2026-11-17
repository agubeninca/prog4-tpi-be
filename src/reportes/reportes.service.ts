import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import dayjs from 'dayjs';
import { pedido_estado, pedido_pago } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDelDia } from '../common/fechas.js';
import { resumirCobros, SELECT_COBRO, sumar } from './resumen-cobros.js';

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

  /**
   * Cierre de caja de un día. Lo cobrado se cuenta por la fecha en que se cobró (no por la del pedido):
   * un pedido de ayer cobrado hoy entra en la caja de hoy. Lo servido y todavía sin cobrar se muestra
   * completo (de cualquier día) porque es plata pendiente.
   */
  async cierreDeCaja(fechaConsulta?: string) {
    const { fecha, desde, hasta } = rangoDelDia(fechaConsulta);
    const delDia = { gte: desde, lte: hasta };

    const [cobrados, pendientes] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { pagado: pedido_pago.PAGADO, fecha_pago: delDia },
        select: SELECT_COBRO,
      }),
      this.pendientes({ fecha_hora_ingreso: delDia }),
    ]);

    return { fecha, cobrado: resumirCobros(cobrados), ...pendientes };
  }

  /**
   * Plata que todavía no entró: lo servido sin cobrar (de cualquier día, porque se debe) y lo que
   * está en curso y lo cancelado dentro del período indicado. Lo usan el cierre del día y el del turno.
   */
  async pendientes(periodo: { fecha_hora_ingreso: { gte: Date; lte?: Date } }) {
    const [sinCobrar, enCurso, cancelados] = await Promise.all([
      this.prisma.pedido.findMany({
        where: {
          estado: pedido_estado.SERVIDO,
          pagado: pedido_pago.PENDIENTE,
        },
        orderBy: { fecha_hora_ingreso: 'asc' },
        select: {
          id_pedido: true,
          fecha_hora_ingreso: true,
          precio_total: true,
          mesa: { select: { numero_mesa: true } },
          cliente: { select: { nombre: true } },
        },
      }),
      this.prisma.pedido.aggregate({
        where: {
          ...periodo,
          estado: {
            in: [pedido_estado.PENDIENTE, pedido_estado.EN_PREPARACION],
          },
        },
        _sum: { precio_total: true },
        _count: true,
      }),
      this.prisma.pedido.aggregate({
        where: { ...periodo, estado: pedido_estado.CANCELADO },
        _sum: { precio_total: true },
        _count: true,
      }),
    ]);

    return {
      sin_cobrar: {
        cantidad: sinCobrar.length,
        total: sumar(sinCobrar.map((p) => p.precio_total)).toFixed(2),
        pedidos: sinCobrar,
      },
      en_curso: {
        cantidad: enCurso._count,
        total: new Decimal((enCurso._sum.precio_total ?? 0).toString()).toFixed(
          2,
        ),
      },
      cancelados: {
        cantidad: cancelados._count,
        total: new Decimal(
          (cancelados._sum.precio_total ?? 0).toString(),
        ).toFixed(2),
      },
    };
  }

  /**
   * Estadísticas de ventas de los últimos N días (contando hoy). Igual que el resumen (RF-08),
   * "vendido" son los pedidos servidos. Día y hora según la zona horaria del servidor.
   */
  async estadisticas(dias = 7) {
    const hasta = dayjs().endOf('day');
    const desde = hasta.subtract(dias - 1, 'day').startOf('day');
    const periodo = { gte: desde.toDate(), lte: hasta.toDate() };

    const [pedidos, productos] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { estado: pedido_estado.SERVIDO, fecha_hora_ingreso: periodo },
        select: {
          fecha_hora_ingreso: true,
          precio_total: true,
          mozo: { select: { id_mozo: true, nombre: true } },
        },
      }),
      this.prisma.detalle_pedido.groupBy({
        by: ['id_producto'],
        where: {
          pedido: {
            estado: pedido_estado.SERVIDO,
            fecha_hora_ingreso: periodo,
          },
        },
        _sum: { cantidad: true, subtotal: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 10,
      }),
    ]);

    const nombres = await this.prisma.producto.findMany({
      where: { id_producto: { in: productos.map((p) => p.id_producto) } },
      select: { id_producto: true, nombre: true },
    });

    // Ventas por día (con los días sin ventas en cero).
    const porDia = new Map<string, { total: Decimal; cantidad: number }>();
    for (let i = 0; i < dias; i++) {
      porDia.set(desde.add(i, 'day').format('YYYY-MM-DD'), {
        total: new Decimal(0),
        cantidad: 0,
      });
    }
    const porHora = Array.from({ length: 24 }, () => ({
      total: new Decimal(0),
      cantidad: 0,
    }));
    const porMozo = new Map<
      string,
      { nombre: string; total: Decimal; cantidad: number }
    >();

    for (const pedido of pedidos) {
      const momento = dayjs(pedido.fecha_hora_ingreso);
      const monto = new Decimal(pedido.precio_total.toString());

      const dia = porDia.get(momento.format('YYYY-MM-DD'));
      if (dia) {
        dia.total = dia.total.plus(monto);
        dia.cantidad += 1;
      }
      const hora = porHora[momento.hour()];
      hora.total = hora.total.plus(monto);
      hora.cantidad += 1;

      // Los pedidos por QR no tienen mozo: se agrupan aparte.
      const clave = pedido.mozo ? String(pedido.mozo.id_mozo) : 'qr';
      const fila = porMozo.get(clave) ?? {
        nombre: pedido.mozo?.nombre ?? 'Sin mozo (QR)',
        total: new Decimal(0),
        cantidad: 0,
      };
      fila.total = fila.total.plus(monto);
      fila.cantidad += 1;
      porMozo.set(clave, fila);
    }

    return {
      desde: desde.format('YYYY-MM-DD'),
      hasta: hasta.format('YYYY-MM-DD'),
      dias,
      total: [...porDia.values()]
        .reduce((t, d) => t.plus(d.total), new Decimal(0))
        .toFixed(2),
      cantidad_pedidos: pedidos.length,
      ventas_por_dia: [...porDia].map(([fecha, d]) => ({
        fecha,
        total: d.total.toFixed(2),
        cantidad: d.cantidad,
      })),
      ventas_por_hora: porHora.map((h, hora) => ({
        hora,
        total: h.total.toFixed(2),
        cantidad: h.cantidad,
      })),
      ventas_por_mozo: [...porMozo.values()]
        .sort((a, b) => b.total.comparedTo(a.total))
        .map((m) => ({
          nombre: m.nombre,
          total: m.total.toFixed(2),
          cantidad: m.cantidad,
        })),
      top_productos: productos.map((p) => ({
        id_producto: p.id_producto,
        nombre:
          nombres.find((n) => n.id_producto === p.id_producto)?.nombre ??
          `Producto #${p.id_producto}`,
        unidades: p._sum.cantidad ?? 0,
        total: new Decimal((p._sum.subtotal ?? 0).toString()).toFixed(2),
      })),
    };
  }
}
