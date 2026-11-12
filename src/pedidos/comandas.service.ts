import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { INCLUDE_PEDIDO, type PedidoCompleto } from './pedido.include.js';

export const COLECCION_COMANDAS = 'pedidos_activos';
const TIMEOUT_FIRESTORE_MS = 3000;
/** Firestore admite hasta 500 operaciones por batch. */
const TAMANIO_BATCH = 400;

/**
 * Copia de cada pedido en Firestore para el panel de Cocina en tiempo real (RF-05).
 * MySQL es la fuente de verdad: si Firestore falla, se loguea y el pedido sigue siendo válido.
 */
@Injectable()
export class ComandasService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ComandasService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  private get coleccion() {
    return this.firebase.firestore.collection(COLECCION_COMANDAS);
  }

  /**
   * Al arrancar, deja Firestore alineado con MySQL. Los emuladores guardan sus datos entre
   * sesiones (firebase-emulator-data/), así que si la base se recreó pueden quedar comandas
   * de pedidos que ya no existen: se borran, y las demás se reescriben con los datos actuales.
   * No bloquea el arranque de la API.
   */
  onApplicationBootstrap() {
    void this.reconciliar().catch((error: unknown) =>
      this.logger.error(
        'No se pudo alinear el panel de comandas con la base',
        error instanceof Error ? error.message : undefined,
      ),
    );
  }

  async reconciliar() {
    const snapshot = await this.conTimeout(this.coleccion.get(), 10_000);
    if (snapshot.empty) {
      return;
    }

    const idsEnFirestore = snapshot.docs
      .map((doc) => Number(doc.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const pedidos = await this.prisma.pedido.findMany({
      where: { id_pedido: { in: idsEnFirestore } },
      include: INCLUDE_PEDIDO,
    });
    const existentes = new Set(pedidos.map((pedido) => pedido.id_pedido));
    const huerfanas = snapshot.docs.filter(
      (doc) => !existentes.has(Number(doc.id)),
    );

    for (let i = 0; i < huerfanas.length; i += TAMANIO_BATCH) {
      const batch = this.firebase.firestore.batch();
      huerfanas
        .slice(i, i + TAMANIO_BATCH)
        .forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    for (let i = 0; i < pedidos.length; i += TAMANIO_BATCH) {
      const batch = this.firebase.firestore.batch();
      pedidos
        .slice(i, i + TAMANIO_BATCH)
        .forEach((pedido) =>
          batch.set(
            this.coleccion.doc(String(pedido.id_pedido)),
            this.aDocumento(pedido),
          ),
        );
      await batch.commit();
    }

    if (huerfanas.length > 0) {
      this.logger.warn(
        `Panel de comandas: se quitaron ${huerfanas.length} comanda(s) de pedidos que ya no existen en la base`,
      );
    }
  }

  async sincronizar(pedido: PedidoCompleto) {
    const escritura = this.coleccion
      .doc(String(pedido.id_pedido))
      .set(this.aDocumento(pedido));
    try {
      await this.conTimeout(escritura);
    } catch (error) {
      this.logger.error(
        `No se pudo sincronizar la comanda #${pedido.id_pedido} con Firestore`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  /** Quita del panel la comanda de un pedido que no existe en la base. */
  async eliminar(idPedido: number) {
    try {
      await this.conTimeout(this.coleccion.doc(String(idPedido)).delete());
    } catch (error) {
      this.logger.error(
        `No se pudo quitar la comanda #${idPedido} de Firestore`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  private aDocumento(pedido: PedidoCompleto) {
    return {
      id_pedido: pedido.id_pedido,
      numero_mesa: pedido.mesa.numero_mesa,
      cliente: { dni: pedido.cliente.dni, nombre: pedido.cliente.nombre },
      estado: pedido.estado,
      pagado: pedido.pagado,
      medio_pago: pedido.medio_pago,
      facturacion: pedido.facturacion,
      cuenta_nombre: pedido.cuenta_nombre,
      cuenta_cuit: pedido.cuenta_cuit,
      origen: pedido.origen,
      motivo_cancelacion: pedido.motivo_cancelacion,
      items: pedido.detalle_pedido.map((detalle) => ({
        nombre: detalle.producto.nombre,
        cantidad: detalle.cantidad,
      })),
      precio_total: pedido.precio_total.toFixed(2),
      fecha_hora_ingreso: pedido.fecha_hora_ingreso,
      fecha_actualizacion: pedido.fecha_actualizacion,
    };
  }

  /**
   * Si el emulador no está levantado, la operación puede quedar reintentando:
   * no se bloquea la respuesta HTTP más allá de unos segundos.
   */
  private conTimeout<T>(operacion: Promise<T>, ms = TIMEOUT_FIRESTORE_MS) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Firestore no respondió a tiempo')),
        ms,
      ),
    );
    return Promise.race([operacion, timeout]);
  }
}
