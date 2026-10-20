import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/validaciones.js';

export class CreateCategoriaDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}
