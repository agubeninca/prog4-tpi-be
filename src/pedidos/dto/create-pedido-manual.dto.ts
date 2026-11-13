import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validaciones.js';
import { CreatePedidoDto } from './create-pedido.dto.js';

/** Comanda cargada a mano por la Barra: se eligen la mesa y el mozo en vez de escanear el QR. */
export class CreatePedidoManualDto extends OmitType(CreatePedidoDto, [
  'hash_codigo_qr',
] as const) {
  @Type(() => Number)
  @IsPositive()
  @IsInt({ message: 'Elegí la mesa' })
  id_mesa: number;

  /** Mozo que atiende la mesa: la mesa queda a su nombre hasta que se pague o cancele todo. */
  @Type(() => Number)
  @IsPositive({ message: 'Elegí el mozo' })
  @IsInt({ message: 'Elegí el mozo' })
  id_mozo: number;

  /** Nota opcional para el registro, ej.: "cliente sin celular". */
  @Trim()
  @IsOptional()
  @MaxLength(255)
  @IsString()
  observacion?: string;
}
