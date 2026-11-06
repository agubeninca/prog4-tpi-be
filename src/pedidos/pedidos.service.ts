import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  pedido_estado,
  pedido_origen,
  pedido_pago,
  Prisma,
} from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDelDia } from '../common/fechas.js';
import { ComandasService } from './comandas.service.js';
import { INCLUDE_PEDIDO, type PedidoCompleto } from './pedido.include.js';
import { CreatePedidoDto } from './dto/create-pedido.dto.js';
import { CreatePedidoManualDto } from './dto/create-pedido-manual.dto.js';
import { FiltroRegistroManualDto } from './dto/filtro-registro-manual.dto.js';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto.js';
import { CambiarPagoPedidoDto } from './dto/cambiar-pago-pedido.dto.js';
import { FiltroPedidosDto } from './dto/filtro-pedidos.dto.js';

/** RF-06: el pedido avanza de a un paso; CANCELADO es posible mientras no esté terminado. */
const TRANSICIONES: Record<pedido_estado, pedido_estado[]> = {
  PENDIENTE: [pedido_estado.EN_PREPARACION, pedido_estado.CANCELADO],
  EN_PREPARACION: [pedido_estado.SERVIDO, pedido_estado.CANCELADO],
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
   * La Barra carga la comanda a mano (ej. clientes que no usan el QR).
   * Queda en el registro de comandas manuales: quién, cuándo y qué se cargó.
   */
  async createManual(
    { id_mesa, dni, nombre, items, observacion }: CreatePedidoManualDto,
    usuario: UsuarioAutenticado,
  ) {
    const pedido = await this.prisma.$transaction(async (tx) => {
      const mesa = await tx.mesa.findFirst({
        where: { id_mesa, activa: true, archivado: false },
      });
      if (!mesa) {
        throw new BadRequestException(
          'La mesa elegida no existe o no está habilitada',
        );
      }

      const creado = await this.crearPedido(tx, {
        id_mesa,
        dni,
        nombre,
        items,
        origen: pedido_origen.MANUAL,
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
        ...(q && {
          cliente: {
            OR: [{ dni: { contains: q } }, { nombre: { contains: q } }],
          },
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

  async cambiarEstado(
    id: number,
    { estado, motivo_cancelacion }: CambiarEstadoPedidoDto,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido #${id} no encontrado`);
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
      // El filtro por estado evita pisar un cambio hecho al mismo tiempo desde otro puesto.
      actualizado = await this.prisma.pedido.update({
        where: { id_pedido: id, estado: pedido.estado },
        data: {
          estado,
          motivo_cancelacion:
            estado === pedido_estado.CANCELADO ? motivo_cancelacion : null,
        },
        include: INCLUDE_PEDIDO,
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

  /** El admin registra el cobro del pedido (o lo vuelve a pendiente si se equivocó). */
  async cambiarPago(id: number, { pagado, medio_pago }: CambiarPagoPedidoDto) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: INCLUDE_PEDIDO,
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido #${id} no encontrado`);
    }
    // Al volver a "pendiente" se borra el medio; pagado, se puede corregir el medio.
    const medio = pagado === pedido_pago.PAGADO ? (medio_pago ?? null) : null;
    if (pedido.pagado === pagado && pedido.medio_pago === medio) {
      return pedido;
    }
    if (
      pagado === pedido_pago.PAGADO &&
      pedido.estado === pedido_estado.CANCELADO
    ) {
      throw new ConflictException(
        'No se puede marcar como pagado un pedido cancelado',
      );
    }

    const actualizado = await this.prisma.pedido.update({
      where: { id_pedido: id },
      data: { pagado, medio_pago: medio },
      include: INCLUDE_PEDIDO,
    });

    await this.comandas.sincronizar(actualizado);
    return actualizado;
  }

  /** Valida cliente y productos y crea el pedido (dentro de la transacción del llamador). */
  private async crearPedido(
    tx: Prisma.TransactionClient,
    { id_mesa, dni, nombre, items, origen }: DatosPedido,
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

    return tx.pedido.create({
      data: {
        id_mesa,
        dni_cliente: dni,
        precio_total,
        origen,
        detalle_pedido: { create: lineas },
      },
      include: INCLUDE_PEDIDO,
    });
  }
}

interface DatosPedido {
  id_mesa: number;
  dni: string;
  nombre?: string;
  items: { id_producto: number; cantidad: number }[];
  origen: pedido_origen;
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
