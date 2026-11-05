import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { pedido_estado, pedido_pago } from '../../../generated/prisma/client.js';
import { FECHA_MENSAJE, FECHA_REGEX, Trim } from '../../common/validaciones.js';

export class FiltroPedidosDto {
  @IsOptional()
  @IsEnum(pedido_estado)
  estado?: pedido_estado;

  @IsOptional()
  @IsEnum(pedido_pago)
  pagado?: pedido_pago;

  /** Un solo día (lo usa el Resumen). Si se indica, tiene prioridad sobre desde/hasta. */
  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  fecha?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  hasta?: string;

  /** Busca por nombre o DNI del cliente (coincidencia parcial). */
  @Trim()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @IsInt()
  numero_mesa?: number;
}
