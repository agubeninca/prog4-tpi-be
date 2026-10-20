import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { pedido_estado, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDelDia } from '../common/fechas.js';
import { ComandasService } from './comandas.service.js';
import { INCLUDE_PEDIDO, type PedidoCompleto } from './pedido.include.js';
import { CreatePedidoDto } from './dto/create-pedido.dto.js';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto.js';
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

      // RB-04: el DNI + nombre generan o actualizan el cliente.
      await tx.cliente.upsert({
        where: { dni },
        update: { nombre },
        create: { dni, nombre },
      });

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
          id_mesa: mesa.id_mesa,
          dni_cliente: dni,
          precio_total,
          detalle_pedido: { create: lineas },
        },
        include: INCLUDE_PEDIDO,
      });
    });

    await this.comandas.sincronizar(pedido);
    return pedido;
  }

  findAll({ estado, fecha }: FiltroPedidosDto) {
    const rango = fecha ? rangoDelDia(fecha) : undefined;
    return this.prisma.pedido.findMany({
      where: {
        estado,
        ...(rango && {
          fecha_hora_ingreso: { gte: rango.desde, lte: rango.hasta },
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
      include: {
        ...INCLUDE_PEDIDO,
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
