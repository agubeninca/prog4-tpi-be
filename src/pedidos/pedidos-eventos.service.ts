import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { pedido_estado } from '../../generated/prisma/client.js';

export interface EventoPedido {
  id_pedido: number;
  estado: pedido_estado;
  motivo_cancelacion: string | null;
}

/**
 * Canal en memoria con los cambios de estado de los pedidos. Lo escucha el cliente (SSE) para
 * enterarse al instante de que su pedido avanzó. El cliente no puede leer Firestore: los documentos
 * de las comandas incluyen DNI y nombre, y sus ids son correlativos.
 * (Si el backend se escalara a varias instancias habría que pasarlo a Redis o similar.)
 */
@Injectable()
export class PedidosEventosService {
  readonly eventos$ = new Subject<EventoPedido>();

  emitir(evento: EventoPedido) {
    this.eventos$.next(evento);
  }
}
