import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validaciones.js';

export class CreateMozoDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre admite hasta 100 caracteres' })
  nombre: string;

  /** Inactivo: no aparece para elegir al cargar una comanda. */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
