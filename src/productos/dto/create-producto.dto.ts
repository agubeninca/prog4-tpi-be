import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validaciones.js';

export class CreateProductoDto {
  @IsInt()
  @IsPositive()
  id_categoria: number;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150)
  nombre: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con hasta 2 decimales' },
  )
  @Min(0)
  @Max(99999999.99)
  precio: number;

  @IsOptional()
  @IsBoolean()
  estado_pausado?: boolean;
}
