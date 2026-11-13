import {
  pedido_estado,
  pedido_pago,
  type Prisma,
} from '../../generated/prisma/client.js';

/**
 * Un pedido "abierto" de un mozo: no está pagado ni cancelado. Mientras una mesa tenga
 * alguno, la mesa la atiende ese mozo y otro no puede cargarle comandas.
 */
export const PEDIDO_ABIERTO_CON_MOZO = {
  id_mozo: { not: null },
  estado: { not: pedido_estado.CANCELADO },
  pagado: pedido_pago.PENDIENTE,
} satisfies Prisma.pedidoWhereInput;

export interface MozoDeMesa {
  id_mozo: number;
  nombre: string;
}

type Consultas = Pick<Prisma.TransactionClient, 'pedido'>;

/**
 * Qué mozo atiende cada mesa ahora (id_mesa → mozo). Si por algún motivo hubiera
 * pedidos abiertos de dos mozos en la misma mesa, la atiende el que llegó primero.
 */
export async function mozosPorMesa(
  db: Consultas,
  filtro: { id_mesa?: number; id_mozo?: number } = {},
) {
  const abiertos = await db.pedido.findMany({
    where: { ...PEDIDO_ABIERTO_CON_MOZO, ...filtro },
    orderBy: { fecha_hora_ingreso: 'asc' },
    select: {
      id_mesa: true,
      mesa: { select: { numero_mesa: true } },
      mozo: { select: { id_mozo: true, nombre: true } },
    },
  });

  const porMesa = new Map<number, MozoDeMesa & { numero_mesa: number }>();
  for (const pedido of abiertos) {
    if (pedido.mozo && !porMesa.has(pedido.id_mesa)) {
      porMesa.set(pedido.id_mesa, {
        ...pedido.mozo,
        numero_mesa: pedido.mesa.numero_mesa,
      });
    }
  }
  return porMesa;
}
