import { ConflictException, Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import dayjs from 'dayjs';
import {
  Prisma,
  pedido_pago,
  type turno,
} from '../../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../auth/auth.types.js';
import { rangoDelDia } from '../common/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportesService } from '../reportes/reportes.service.js';
import { resumirCobros, SELECT_COBRO } from '../reportes/resumen-cobros.js';
import { AbrirTurnoDto } from './dto/abrir-turno.dto.js';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto.js';
import { FiltroTurnosDto } from './dto/filtro-turnos.dto.js';
import { describirTurno } from './etiquetas.js';

const INCLUDE_USUARIOS = {
  usuario_apertura: { select: { nombre: true, nombre_usuario: true } },
  usuario_cierre: { select: { nombre: true, nombre_usuario: true } },
} satisfies Prisma.turnoInclude;

const MAX_TURNOS_HISTORIAL = 100;

/**
 * Turnos de caja. Se abre uno con el efectivo inicial; cada cobro queda en el turno abierto
 * (sin turno abierto no se puede cobrar). En el cambio de turno se cierra contando la plata:
 * se compara con lo esperado (inicial + cobrado en efectivo) y se congela el resumen.
 */
@Injectable()
export class TurnosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportes: ReportesService,
  ) {}

  /** El turno abierto con su resumen en vivo, o null si no hay ninguno. */
  async actual() {
    const turno = await this.prisma.turno.findUnique({
      where: { abierto: true },
      include: INCLUDE_USUARIOS,
    });
    if (!turno) {
      return null;
    }
    const resumen = await this.resumen(turno);
    return {
      ...turno,
      efectivo_esperado: this.esperado(turno, resumen).toFixed(2),
      resumen,
    };
  }

  async abrir(
    { nombre, efectivo_inicial }: AbrirTurnoDto,
    usuario: UsuarioAutenticado,
  ) {
    const abierto = await this.prisma.turno.findUnique({
      where: { abierto: true },
    });
    if (abierto) {
      throw new ConflictException(
        `Ya está abierto el ${describirTurno(abierto)}. Cerralo antes de abrir otro`,
      );
    }
    try {
      return await this.prisma.turno.create({
        data: {
          nombre,
          abierto: true,
          efectivo_inicial,
          id_usuario_apertura: usuario.id_usuario,
        },
        include: INCLUDE_USUARIOS,
      });
    } catch (error) {
      // Otro lo abrió en el mismo momento: el índice único de `abierto` lo frena.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya hay un turno abierto: alguien lo abrió recién. Actualizá la pantalla',
        );
      }
      throw error;
    }
  }

  async cerrar(
    { efectivo_contado, observacion }: CerrarTurnoDto,
    usuario: UsuarioAutenticado,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Bloquea el turno: un cobro que llegue mientras se cierra espera y, al seguir, ya no lo encuentra abierto.
      const [bloqueado] = await tx.$queryRaw<{ id_turno: number }[]>`
        SELECT id_turno FROM turno WHERE abierto = 1 FOR UPDATE`;
      if (!bloqueado) {
        throw new ConflictException('No hay un turno abierto para cerrar');
      }
      const turno = await tx.turno.findUniqueOrThrow({
        where: { id_turno: bloqueado.id_turno },
      });

      const ahora = new Date();
      const resumen = await this.resumen(turno, ahora);
      const esperado = this.esperado(turno, resumen);
      const contado = new Decimal(efectivo_contado);

      return tx.turno.update({
        where: { id_turno: turno.id_turno },
        data: {
          abierto: null,
          fecha_cierre: ahora,
          id_usuario_cierre: usuario.id_usuario,
          efectivo_esperado: esperado.toFixed(2),
          efectivo_contado: contado.toFixed(2),
          diferencia: contado.minus(esperado).toFixed(2),
          observacion_cierre: observacion || null,
          // Se guarda como JSON plano (fechas como texto, montos como string).
          resumen: JSON.parse(JSON.stringify(resumen)) as Prisma.InputJsonValue,
        },
        include: INCLUDE_USUARIOS,
      });
    });
  }

  /** Turnos cerrados (los más nuevos primero), con su arqueo y el resumen tal como se cerró. */
  historial({ desde, hasta }: FiltroTurnosDto) {
    return this.prisma.turno.findMany({
      where: {
        abierto: null,
        fecha_apertura: {
          ...(desde && { gte: rangoDelDia(desde).desde }),
          ...(hasta && { lte: rangoDelDia(hasta).hasta }),
        },
      },
      orderBy: { fecha_apertura: 'desc' },
      take: MAX_TURNOS_HISTORIAL,
      include: INCLUDE_USUARIOS,
    });
  }

  private async resumen(turno: turno, hasta?: Date) {
    const [cobrados, pendientes] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { id_turno_pago: turno.id_turno, pagado: pedido_pago.PAGADO },
        select: SELECT_COBRO,
      }),
      this.reportes.pendientes({
        fecha_hora_ingreso: { gte: turno.fecha_apertura, lte: hasta },
      }),
    ]);
    return {
      calculado: dayjs(hasta).toISOString(),
      cobrado: resumirCobros(cobrados),
      ...pendientes,
    };
  }

  private esperado(
    turno: turno,
    resumen: Awaited<ReturnType<TurnosService['resumen']>>,
  ) {
    return new Decimal(turno.efectivo_inicial.toString()).plus(
      resumen.cobrado.efectivo_en_caja,
    );
  }
}
