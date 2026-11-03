import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service.js';

export const COLECCION_ERRORES = 'errores';
const TIMEOUT_FIRESTORE_MS = 3000;
const LIMITE_LECTURA = 500;
const TAMANIO_LOTE_BORRADO = 400;

export type TipoSistema = 'backend' | 'frontend';

export interface DatosError {
  tipo_sistema: TipoSistema;
  mensaje: string;
  stack?: string | null;
  /** Backend: "GET /ruta"; frontend: la ruta de la pantalla. */
  contexto?: string | null;
  /** Personal logueado (solo errores de backend: del frontend no se puede confiar). */
  usuario?: string | null;
  /** User-Agent del navegador (solo frontend). */
  navegador?: string | null;
}

/** Log de errores de backend y frontend en Firestore, con una estructura única definida acá. */
@Injectable()
export class ErroresService {
  private readonly logger = new Logger(ErroresService.name);

  constructor(private readonly firebase: FirebaseService) {}

  /** Nunca tira ni bloquea: si Firestore no responde, se loguea por consola y se sigue. */
  async registrarError(datos: DatosError) {
    const escritura = this.firebase.firestore
      .collection(COLECCION_ERRORES)
      .add({
        tipo_sistema: datos.tipo_sistema,
        mensaje: datos.mensaje,
        stack: datos.stack ?? null,
        contexto: datos.contexto ?? null,
        usuario: datos.usuario ?? null,
        navegador: datos.navegador ?? null,
        fecha_hora: new Date(),
      });
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
        `No se pudo registrar el error en Firestore: ${datos.mensaje}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  /**
   * Últimos errores, del más nuevo al más viejo. El filtro por tipo se hace en memoria
   * para no necesitar un índice compuesto (tipo + fecha) en un Firestore real.
   */
  async listar(tipo: TipoSistema | undefined, limite: number) {
    const snapshot = await this.firebase.firestore
      .collection(COLECCION_ERRORES)
      .orderBy('fecha_hora', 'desc')
      .limit(LIMITE_LECTURA)
      .get();

    return snapshot.docs
      .map((doc) => {
        const datos = doc.data();
        return {
          id: doc.id,
          tipo_sistema: datos.tipo_sistema as TipoSistema,
          mensaje: datos.mensaje as string,
          stack: (datos.stack as string | null) ?? null,
          contexto: (datos.contexto as string | null) ?? null,
          usuario: (datos.usuario as string | null) ?? null,
          navegador: (datos.navegador as string | null) ?? null,
          fecha_hora: (datos.fecha_hora as FirebaseFirestore.Timestamp)
            .toDate()
            .toISOString(),
        };
      })
      .filter((error) => !tipo || error.tipo_sistema === tipo)
      .slice(0, limite);
  }

  /** Vacía el log (en lotes: Firestore admite hasta 500 operaciones por batch). */
  async vaciar() {
    const coleccion = this.firebase.firestore.collection(COLECCION_ERRORES);
    let eliminados = 0;
    for (;;) {
      const lote = await coleccion.limit(TAMANIO_LOTE_BORRADO).get();
      if (lote.empty) break;
      const batch = this.firebase.firestore.batch();
      lote.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      eliminados += lote.size;
    }
    return { eliminados };
  }
}
