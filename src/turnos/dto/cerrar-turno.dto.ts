import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validaciones.js';

export class CerrarTurnoDto {
  /** Lo que se contó en la caja (billetes) al cerrar. */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El efectivo contado debe ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  @Max(99999999.99)
  efectivo_contado: number;

  /** Ej.: por qué falta o sobra plata. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255, { message: 'La observación admite hasta 255 caracteres' })
  observacion?: string;
}
