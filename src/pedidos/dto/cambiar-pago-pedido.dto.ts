import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  pedido_facturacion,
  pedido_medio_pago,
  pedido_pago,
} from '../../../generated/prisma/client.js';
import { Trim } from '../../common/validaciones.js';

export class CambiarPagoPedidoDto {
  @IsEnum(pedido_pago)
  pagado: pedido_pago;

  /** Obligatorio al marcarlo como pagado (queda como registro histórico). */
  @ValidateIf((dto: CambiarPagoPedidoDto) => dto.pagado === pedido_pago.PAGADO)
  @IsEnum(pedido_medio_pago, { message: 'Elegí el medio de pago' })
  medio_pago?: pedido_medio_pago;

  /** A quién se le cobró. Si no se indica, queda como consumidor final. */
  @IsOptional()
  @IsEnum(pedido_facturacion, {
    message: 'Indicá si es consumidor final o una cuenta',
  })
  facturacion?: pedido_facturacion;

  /** Nombre o razón social: obligatorio cuando se le cobra a una cuenta. */
  @ValidateIf(
    (dto: CambiarPagoPedidoDto) =>
      dto.pagado === pedido_pago.PAGADO &&
      dto.facturacion === pedido_facturacion.CUENTA,
  )
  @Trim()
  @MaxLength(150, {
    message: 'El nombre de la cuenta admite hasta 150 caracteres',
  })
  @IsNotEmpty({ message: 'Indicá el nombre o la razón social de la cuenta' })
  @IsString({ message: 'Indicá el nombre o la razón social de la cuenta' })
  cuenta_nombre?: string;

  /** CUIT opcional: se aceptan guiones o espacios y se guarda solo con los 11 dígitos. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.replace(/[\s-]/g, '') || undefined
      : value,
  )
  @IsOptional()
  @Matches(/^\d{11}$/, {
    message: 'El CUIT debe tener 11 dígitos (ej.: 20-12345678-9)',
  })
  @IsString({ message: 'El CUIT debe tener 11 dígitos (ej.: 20-12345678-9)' })
  cuenta_cuit?: string;
}
