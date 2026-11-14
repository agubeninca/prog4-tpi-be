import type { Prisma, pedido_estado } from '../../generated/prisma/client.js';

interface CambioEstado {
  id_pedido: number;
  /** Null en el alta del pedido. */
  anterior: pedido_estado | null;
  nuevo: pedido_estado;
  /** Null cuando lo hizo el cliente (alta por QR). */
  id_usuario?: number | null;
  motivo?: string | null;
}

/** Deja asentado quién y cuándo cambió el estado de un pedido (se llama dentro de la misma transacción). */
export function registrarCambioEstado(
  tx: Prisma.TransactionClient,
  { id_pedido, anterior, nuevo, id_usuario, motivo }: CambioEstado,
) {
  return tx.historial_estado_pedido.create({
    data: {
      id_pedido,
      estado_anterior: anterior,
      estado_nuevo: nuevo,
      id_usuario: id_usuario ?? null,
      motivo: motivo ?? null,
    },
  });
}
