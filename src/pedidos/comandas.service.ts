import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service.js';
import type { PedidoCompleto } from './pedido.include.js';

export const COLECCION_COMANDAS = 'pedidos_activos';
const TIMEOUT_FIRESTORE_MS = 3000;

/**
 * Copia de cada pedido en Firestore para el panel de Cocina en tiempo real (RF-05).
 * MySQL es la fuente de verdad: si Firestore falla, se loguea y el pedido sigue siendo válido.
 */
@Injectable()
export class ComandasService {
  private readonly logger = new Logger(ComandasService.name);

  constructor(private readonly firebase: FirebaseService) {}

  async sincronizar(pedido: PedidoCompleto) {
    const escritura = this.firebase.firestore
      .collection(COLECCION_COMANDAS)
      .doc(String(pedido.id_pedido))
      .set({
        id_pedido: pedido.id_pedido,
        numero_mesa: pedido.mesa.numero_mesa,
        cliente: { dni: pedido.cliente.dni, nombre: pedido.cliente.nombre },
        estado: pedido.estado,
        motivo_cancelacion: pedido.motivo_cancelacion,
        items: pedido.detalle_pedido.map((detalle) => ({
          nombre: detalle.producto.nombre,
          cantidad: detalle.cantidad,
        })),
        precio_total: pedido.precio_total.toFixed(2),
        fecha_hora_ingreso: pedido.fecha_hora_ingreso,
        fecha_actualizacion: pedido.fecha_actualizacion,
      });

    // Si el emulador no está levantado, la escritura puede quedar reintentando:
    // no se bloquea la respuesta HTTP más allá de unos segundos.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Firestore no respondió a tiempo')),
        TIMEOUT_FIRESTORE_MS,
      ),
    );

    try {
      await Promise.race([escritura, timeout]);
    } catch (error) {
      this.logger.error(
        `No se pudo sincronizar la comanda #${pedido.id_pedido} con Firestore`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }
}
