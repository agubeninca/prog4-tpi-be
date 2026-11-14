import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  filter,
  interval,
  map,
  merge,
  of,
  share,
  takeUntil,
  takeWhile,
} from 'rxjs';
import type { Observable } from 'rxjs';
import {
  pedido_estado,
  pedido_facturacion,
  pedido_origen,
  pedido_pago,
  Prisma,
} from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDelDia } from '../common/fechas.js';
import { mozosPorMesa } from '../mozos/mesas-atendidas.js';
import { ComandasService } from './comandas.service.js';
import { PedidosEventosService } from './pedidos-eventos.service.js';
import { registrarCambioEstado } from './historial-estado.js';
import { INCLUDE_PEDIDO, type PedidoCompleto } from './pedido.include.js';
import { CreatePedidoDto } from './dto/create-pedido.dto.js';
import { CreatePedidoManualDto } from './dto/create-pedido-manual.dto.js';
import { FiltroRegistroManualDto } from './dto/filtro-registro-manual.dto.js';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto.js';
import { CambiarPagoPedidoDto } from './dto/cambiar-pago-pedido.dto.js';
import { FiltroPedidosDto } from './dto/filtro-pedidos.dto.js';

/**
 * RF-06: el pedido avanza de a un paso; CANCELADO es posible mientras no esté terminado.
 * Un pedido "En preparación" puede volver a "Pendiente" (la Barra lo tomó por error).
 */
const TRANSICIONES: Record<pedido_estado, pedido_estado[]> = {
  PENDIENTE: [pedido_estado.EN_PREPARACION, pedido_estado.CANCELADO],
  EN_PREPARACION: [
    pedido_estado.SERVIDO,
    pedido_estado.PENDIENTE,
    pedido_estado.CANCELADO,
  ],
  SERVIDO: [],
  CANCELADO: [],
};

const ETIQUETA_ESTADO: Record<pedido_estado, string> = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  SERVIDO: 'Servido',
  CANCELADO: 'Cancelado',
};

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comandas: ComandasService,
    private readonly eventos: PedidosEventosService,
  ) {}

  /** RF-04: el cliente confirma su comanda desde la mesa (QR). */
  async create({ hash_codigo_qr, dni, nombre, items }: CreatePedidoDto) {
    const pedido = await this.prisma.$transaction(async (tx) => {
      // RB-03: todo pedido queda vinculado a una mesa válida.
      const mesa = await tx.mesa.findFirst({
        where: { hash_codigo_qr, activa: true, archivado: false },
      });
      if (!mesa) {
        throw new BadRequestException(
          'La mesa del QR no existe o no está habilitada',
        );
      }
      return this.crearPedido(tx, {
        id_mesa: mesa.id_mesa,
        dni,
        nombre,
        items,
        origen: pedido_origen.QR,
      });
    });

    await this.comandas.sincronizar(pedido);
    // Respuesta pública: sin el nombre del cliente (se ve con solo saber un DNI).
    return { ...pedido, cliente: undefined };
  }

  /**
   * La Barra carga la comanda a mano (ej. clientes que no usan el QR), a nombre del mozo
   * que atiende la mesa. La mesa queda tomada por ese mozo mientras tenga pedidos sin pagar
   * ni cancelar: otro mozo no le puede cargar comandas.
   * Queda en el registro de comandas manuales: quién, cuándo y qué se cargó.
   */
  async createManual(
    {
      id_mesa,
      id_mozo,
      dni,
      nombre,
      items,
      observacion,
    }: CreatePedidoManualDto,
    usuario: UsuarioAutenticado,
  ) {
    const pedido = await this.prisma.$transaction(async (tx) => {
      // Bloquea la fila de la mesa hasta terminar: si dos mozos cargan a la vez en la
      // misma mesa libre, el segundo espera y ve que ya la tomó el primero.
      await tx.$queryRaw`SELECT id_mesa FROM mesa WHERE id_mesa = ${id_mesa} FOR UPDATE`;
      const mesa = await tx.mesa.findFirst({
        where: { id_mesa, activa: true, archivado: false },
      });
      if (!mesa) {
        throw new BadRequestException(
          'La mesa elegida no existe o no está habilitada',
        );
      }

      const mozo = await tx.mozo.findFirst({
        where: { id_mozo, archivado: false },
      });
      if (!mozo) {
        throw new BadRequestException('El mozo elegido no existe');
      }
      if (!mozo.activo) {
        throw new BadRequestException(
          `${mozo.nombre} está inactivo. Activalo desde la pestaña Mozos o elegí otro`,
        );
      }

      const atiende = (await mozosPorMesa(tx, { id_mesa })).get(id_mesa);
      if (atiende && atiende.id_mozo !== id_mozo) {
        throw new ConflictException(
          `La mesa ${mesa.numero_mesa} la está atendiendo ${atiende.nombre}. Se libera cuando sus pedidos estén pagados o cancelados`,
        );
      }

      const creado = await this.crearPedido(tx, {
        id_mesa,
        id_mozo,
        dni,
        nombre,
        items,
        origen: pedido_origen.MANUAL,
        id_usuario: usuario.id_usuario,
      });

      await tx.registro_comanda_manual.create({
        data: {
          id_pedido: creado.id_pedido,
          id_usuario: usuario.id_usuario,
          fecha_hora: creado.fecha_hora_ingreso,
          detalle: resumenComanda(creado),
          observacion: observacion || null,
        },
      });
      return creado;
    });

    await this.comandas.sincronizar(pedido);
    return pedido;
  }

  /** Registro de comandas manuales, de la más nueva a la más vieja (hasta 500). */
  findRegistroManual({ desde, hasta }: FiltroRegistroManualDto) {
    const fechas = {
      ...(desde && { gte: rangoDelDia(desde).desde }),
      ...(hasta && { lte: rangoDelDia(hasta).hasta }),
    };
    return this.prisma.registro_comanda_manual.findMany({
      where: Object.keys(fechas).length > 0 ? { fecha_hora: fechas } : {},
      orderBy: { fecha_hora: 'desc' },
      take: 500,
      include: {
        usuario: {
          select: { id_usuario: true, nombre: true, nombre_usuario: true },
        },
        pedido: { include: INCLUDE_PEDIDO },
      },
    });
  }

  /** Historial de pedidos, del más nuevo al más viejo (hasta 500). */
  findAll({
    estado,
    pagado,
    fecha,
    desde,
    hasta,
    q,
    numero_mesa,
  }: FiltroPedidosDto) {
    const fechas = fecha
      ? { gte: rangoDelDia(fecha).desde, lte: rangoDelDia(fecha).hasta }
      : {
          ...(desde && { gte: rangoDelDia(desde).desde }),
          ...(hasta && { lte: rangoDelDia(hasta).hasta }),
        };
    return this.prisma.pedido.findMany({
      where: {
        estado,
        pagado,
        ...(Object.keys(fechas).length > 0 && { fecha_hora_ingreso: fechas }),
        ...(numero_mesa && { mesa: { numero_mesa } }),
        // Por cliente (nombre o DNI) o por la cuenta a la que se le cobró (nombre o CUIT).
        ...(q && {
          OR: [
            { cliente: { dni: { contains: q } } },
            { cliente: { nombre: { contains: q } } },
            { cuenta_nombre: { contains: q } },
            { cuenta_cuit: { contains: q.replace(/[\s-]/g, '') || q } },
          ],
        }),
      },
      orderBy: { fecha_hora_ingreso: 'desc' },
      take: 500,
      include: INCLUDE_PEDIDO,
    });
  }

  /** Consulta del propio cliente: si el DNI no coincide, responde como si no existiera. */
  async findOneParaCliente(id: number, dni: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id_pedido: id, dni_cliente: dni },
      // Sin el cliente: es público y alcanza con saber el DNI para consultarlo.
      include: {
        mesa: INCLUDE_PEDIDO.mesa,
        detalle_pedido: INCLUDE_PEDIDO.detalle_pedido,
        review: { orderBy: { fecha_hora: 'desc' } },
      },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido #${id} no encontrado`);
    }
    return pedido;
  }

  /** Quién y cuándo cambió el estado del pedido (incluye el alta y los "volver atrás"). */
  async findHistorial(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
      select: { id_pedido: true },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido #${id} no encontrado`);
    }
    return this.prisma.historial_estado_pedido.findMany({
      where: { id_pedido: id },
      orderBy: [{ fecha_hora: 'asc' }, { id_historial: 'asc' }],
      include: {
        usuario: {
          select: { id_usuario: true, nombre: true, nombre_usuario: true },
        },
      },
    });
  }

  /**
   * Últimos pedidos de un cliente, para "pedir de nuevo". Público: se identifica con el DNI
   * (igual que GET /pedidos/:id) y devuelve solo lo consumido, sin el nombre del cliente.
   */
  findRecientesDelCliente(dni: string) {
    return this.prisma.pedido.findMany({
      where: { dni_cliente: dni, estado: { not: pedido_estado.CANCELADO } },
      orderBy: { fecha_hora_ingreso: 'desc' },
      take: 10,
      select: {
        id_pedido: true,
        fecha_hora_ingreso: true,
        estado: true,
        precio_total: true,
        mesa: { select: { numero_mesa: true } },
        detalle_pedido: {
          select: {
            cantidad: true,
            producto: { select: { id_producto: true, nombre: true } },
          },
        },
      },
    });
  }

  /**
   * Eventos en vivo del pedido (SSE): primero el estado actual y después cada cambio.
   * Se cierra solo cuando el pedido termina (servido o cancelado). Cada 25 s manda un "ping"
   * para que ningún proxy corte la conexión por inactividad.
   */
  async eventosDelPedido(
    id: number,
    dni: string,
  ): Promise<Observable<{ type: string; data: object }>> {
    const actual = await this.findOneParaCliente(id, dni);
    const esFinal = (estado: pedido_estado) =>
      estado === pedido_estado.SERVIDO || estado === pedido_estado.CANCELADO;
    const evento = (estado: pedido_estado, motivo: string | null) => ({
      type: 'estado',
      data: { estado, motivo_cancelacion: motivo },
    });

    // Ya terminado: se informa el estado y se cierra.
    if (esFinal(actual.estado)) {
      return of(evento(actual.estado, actual.motivo_cancelacion));
    }

    const cambios$ = this.eventos.eventos$.pipe(
      filter((e) => e.id_pedido === id),
      takeWhile((e) => !esFinal(e.estado), true),
      share(),
    );
    const termino$ = cambios$.pipe(filter((e) => esFinal(e.estado)));

    return merge(
      of(evento(actual.estado, actual.motivo_cancelacion)),
      cambios$.pipe(map((e) => evento(e.estado, e.motivo_cancelacion))),
      interval(25_000).pipe(
        map(() => ({ type: 'ping', data: {} })),
        takeUntil(termino$),
      ),
    );
  }

  async cambiarEstado(
    id: number,
    { estado, motivo_cancelacion }: CambiarEstadoPedidoDto,
    usuario: UsuarioAutenticado,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
    });
    if (!pedido) {
      return this.pedidoInexistente(id);
    }

    if (!TRANSICIONES[pedido.estado].includes(estado)) {
      throw new ConflictException(
        `No se puede pasar un pedido de "${ETIQUETA_ESTADO[pedido.estado]}" a "${ETIQUETA_ESTADO[estado]}"`,
      );
    }
    if (estado === pedido_estado.CANCELADO && !motivo_cancelacion) {
      throw new BadRequestException('Indicá el motivo de la cancelación');
    }

    let actualizado: PedidoCompleto;
    try {
      actualizado = await this.prisma.$transaction(async (tx) => {
        // El filtro por estado evita pisar un cambio hecho al mismo tiempo desde otro puesto.
        const resultado = await tx.pedido.update({
          where: { id_pedido: id, estado: pedido.estado },
          data: {
            estado,
            motivo_cancelacion:
              estado === pedido_estado.CANCELADO ? motivo_cancelacion : null,
          },
          include: INCLUDE_PEDIDO,
        });
        await registrarCambioEstado(tx, {
          id_pedido: id,
          anterior: pedido.estado,
          nuevo: estado,
          id_usuario: usuario.id_usuario,
          motivo:
            estado === pedido_estado.CANCELADO ? motivo_cancelacion : null,
        });
        return resultado;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(
          'El pedido cambió de estado mientras tanto. Actualizá la pantalla',
        );
      }
      throw error;
    }

    await this.comandas.sincronizar(actualizado);
    return actualizado;
  }

  /**
   * Registra el cobro del pedido: medio de pago y a quién se le cobró (consumidor final o una
   * cuenta con nombre / razón social y CUIT). Pagado, se puede volver a llamar para corregir
   * esos datos; al volverlo a "pendiente" se borran.
   */
  async cambiarPago(
    id: number,
    {
      pagado,
      medio_pago,
      facturacion,
      cuenta_nombre,
      cuenta_cuit,
    }: CambiarPagoPedidoDto,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: INCLUDE_PEDIDO,
    });
    if (!pedido) {
      return this.pedidoInexistente(id);
    }

    const esPagado = pagado === pedido_pago.PAGADO;
    const tipo = esPagado
      ? (facturacion ?? pedido_facturacion.CONSUMIDOR_FINAL)
      : null;
    const esCuenta = tipo === pedido_facturacion.CUENTA;
    const datos = {
      pagado,
      medio_pago: esPagado ? (medio_pago ?? null) : null,
      facturacion: tipo,
      cuenta_nombre: esCuenta ? (cuenta_nombre ?? null) : null,
      cuenta_cuit: esCuenta ? (cuenta_cuit ?? null) : null,
    };

    const sinCambios = (Object.keys(datos) as (keyof typeof datos)[]).every(
      (campo) => pedido[campo] === datos[campo],
    );
    if (sinCambios) {
      return pedido;
    }
    if (esPagado && pedido.estado === pedido_estado.CANCELADO) {
      throw new ConflictException(
        'No se puede marcar como pagado un pedido cancelado',
      );
    }

    // Fecha de cobro (cierre de caja): se fija al pasar a pagado y se conserva si solo se corrigen los datos.
    const fecha_pago = esPagado ? (pedido.fecha_pago ?? new Date()) : null;
    const actualizado = await this.prisma.pedido.update({
      where: { id_pedido: id },
      data: { ...datos, fecha_pago },
      include: INCLUDE_PEDIDO,
    });

    await this.comandas.sincronizar(actualizado);
    return actualizado;
  }

  /** Valida cliente y productos y crea el pedido (dentro de la transacción del llamador). */
  private async crearPedido(
    tx: Prisma.TransactionClient,
    { id_mesa, id_mozo, dni, nombre, items, origen, id_usuario }: DatosPedido,
  ): Promise<PedidoCompleto> {
    // RB-04: el DNI + nombre generan el cliente. Si ya existe, el nombre no se pisa
    // (desde la mesa no se puede cambiar el de otro; lo corrige el admin).
    const cliente = await tx.cliente.findUnique({ where: { dni } });
    if (!cliente) {
      if (!nombre) {
        throw new BadRequestException('El nombre y apellido es obligatorio');
      }
      await tx.cliente.create({ data: { dni, nombre } });
    }

    // Un mismo producto agregado dos veces se suma en una sola línea.
    const cantidades = new Map<number, number>();
    for (const item of items) {
      cantidades.set(
        item.id_producto,
        (cantidades.get(item.id_producto) ?? 0) + item.cantidad,
      );
    }

    const productos = await tx.producto.findMany({
      where: { id_producto: { in: [...cantidades.keys()] } },
    });

    const lineas = [...cantidades].map(([id_producto, cantidad]) => {
      const producto = productos.find((p) => p.id_producto === id_producto);
      if (!producto || producto.archivado) {
        throw productoNoDisponible(
          id_producto,
          'Un producto del pedido ya no existe',
        );
      }
      // RB-02: no se pueden pedir productos pausados.
      if (producto.estado_pausado) {
        throw productoNoDisponible(
          id_producto,
          `"${producto.nombre}" no está disponible en este momento`,
        );
      }
      const precioUnitario = new Decimal(producto.precio.toString());
      return {
        id_producto,
        cantidad,
        precio_unitario: precioUnitario.toFixed(2),
        subtotal: precioUnitario.times(cantidad).toFixed(2),
      };
    });

    const precio_total = lineas
      .reduce((total, linea) => total.plus(linea.subtotal), new Decimal(0))
      .toFixed(2);

    const creado = await tx.pedido.create({
      data: {
        id_mesa,
        id_mozo: id_mozo ?? null,
        dni_cliente: dni,
        precio_total,
        origen,
        detalle_pedido: { create: lineas },
      },
      include: INCLUDE_PEDIDO,
    });
    await registrarCambioEstado(tx, {
      id_pedido: creado.id_pedido,
      anterior: null,
      nuevo: creado.estado,
      id_usuario,
    });
    return creado;
  }
  /**
   * El panel de comandas lee de Firestore: si ahí quedó la comanda de un pedido que ya no
   * existe en la base (ej. se recreó la base), se la quita para que desaparezca del panel.
   */
  private async pedidoInexistente(id: number): Promise<never> {
    await this.comandas.eliminar(id);
    throw new NotFoundException(
      `El pedido #${id} ya no existe en la base de datos. Se quitó del panel de comandas`,
    );
  }
}

interface DatosPedido {
  id_mesa: number;
  /** Solo en las comandas manuales. */
  id_mozo?: number;
  dni: string;
  nombre?: string;
  items: { id_producto: number; cantidad: number }[];
  origen: pedido_origen;
  /** Quien carga la comanda a mano; null si la hizo el cliente por QR. */
  id_usuario?: number;
}

/** "2 × Café con leche, 1 × Medialuna": copia legible de la comanda para el registro. */
function resumenComanda(pedido: PedidoCompleto) {
  return pedido.detalle_pedido
    .map((detalle) => `${detalle.cantidad} × ${detalle.producto.nombre}`)
    .join(', ')
    .slice(0, 1000);
}

/** 400 con el id del producto, para que el front pueda sacarlo del carrito. */
function productoNoDisponible(id_producto: number, message: string) {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message,
    id_producto,
  });
}
