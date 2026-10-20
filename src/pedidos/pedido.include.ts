import type { Prisma } from '../../generated/prisma/client.js';

/** Forma en que se devuelve un pedido: con mesa, cliente e ítems (con el nombre del producto). */
export const INCLUDE_PEDIDO = {
  mesa: { select: { id_mesa: true, numero_mesa: true } },
  cliente: { select: { dni: true, nombre: true } },
  detalle_pedido: {
    include: { producto: { select: { id_producto: true, nombre: true } } },
  },
} satisfies Prisma.pedidoInclude;

export type PedidoCompleto = Prisma.pedidoGetPayload<{
  include: typeof INCLUDE_PEDIDO;
}>;
