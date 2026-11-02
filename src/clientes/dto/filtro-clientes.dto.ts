import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/validaciones.js';

export class FiltroClientesDto {
  /** Busca por DNI o por nombre y apellido (coincidencia parcial). */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
