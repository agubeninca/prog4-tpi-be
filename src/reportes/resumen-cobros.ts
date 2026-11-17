import { Decimal } from 'decimal.js';
import {
  pedido_facturacion,
  pedido_medio_pago,
  type Prisma,
} from '../../generated/prisma/client.js';

/** Lo que hace falta de cada pedido cobrado para armar un cierre de caja. */
export const SELECT_COBRO = {
  id_pedido: true,
  precio_total: true,
  medio_pago: true,
  facturacion: true,
  cuenta_nombre: true,
  cuenta_cuit: true,
  mozo: { select: { id_mozo: true, nombre: true } },
} satisfies Prisma.pedidoSelect;

export type Cobro = Prisma.pedidoGetPayload<{ select: typeof SELECT_COBRO }>;

export function sumar(valores: { toString(): string }[]) {
  return valores.reduce<Decimal>(
    (total, valor) => total.plus(valor.toString()),
    new Decimal(0),
  );
}

/**
 * Resumen de lo cobrado: total, por medio de pago, efectivo, por cuenta (nombre / CUIT) y
 * por mozo. Lo usan el cierre de caja del día y el de cada turno.
 */
export function resumirCobros(cobrados: Cobro[]) {
  // Los que no tienen medio cargado quedan como "SIN_MEDIO".
  const medios = [
    ...Object.values(pedido_medio_pago),
    null,
  ] as (pedido_medio_pago | null)[];
  const por_medio = medios
    .map((medio) => {
      const delMedio = cobrados.filter((p) => p.medio_pago === medio);
      return {
        medio: medio ?? 'SIN_MEDIO',
        cantidad: delMedio.length,
        total: sumar(delMedio.map((p) => p.precio_total)).toFixed(2),
      };
    })
    .filter((fila) => fila.cantidad > 0);

  const cuentas = new Map<
    string,
    { nombre: string; cuit: string | null; cantidad: number; total: Decimal }
  >();
  for (const p of cobrados.filter(
    (x) => x.facturacion === pedido_facturacion.CUENTA,
  )) {
    const clave = `${p.cuenta_nombre ?? ''}|${p.cuenta_cuit ?? ''}`;
    const fila = cuentas.get(clave) ?? {
      nombre: p.cuenta_nombre ?? 'Sin nombre',
      cuit: p.cuenta_cuit,
      cantidad: 0,
      total: new Decimal(0),
    };
    fila.cantidad += 1;
    fila.total = fila.total.plus(p.precio_total.toString());
    cuentas.set(clave, fila);
  }

  // Los pedidos por QR no tienen mozo: se agrupan aparte.
  const mozos = new Map<
    string,
    { nombre: string; cantidad: number; total: Decimal }
  >();
  for (const p of cobrados) {
    const clave = p.mozo ? String(p.mozo.id_mozo) : 'qr';
    const fila = mozos.get(clave) ?? {
      nombre: p.mozo?.nombre ?? 'Sin mozo (QR)',
      cantidad: 0,
      total: new Decimal(0),
    };
    fila.cantidad += 1;
    fila.total = fila.total.plus(p.precio_total.toString());
    mozos.set(clave, fila);
  }

  const efectivo = por_medio.find(
    (fila) => fila.medio === pedido_medio_pago.EFECTIVO,
  );
  return {
    total: sumar(cobrados.map((p) => p.precio_total)).toFixed(2),
    cantidad: cobrados.length,
    por_medio,
    /** Billetes que entraron a la caja: solo el cobro en efectivo. */
    efectivo_en_caja: efectivo?.total ?? '0.00',
    cuentas: [...cuentas.values()].map((c) => ({
      ...c,
      total: c.total.toFixed(2),
    })),
    por_mozo: [...mozos.values()]
      .sort((a, b) => b.total.comparedTo(a.total))
      .map((m) => ({ ...m, total: m.total.toFixed(2) })),
  };
}
