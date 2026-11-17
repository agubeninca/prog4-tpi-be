import { IsOptional, Matches } from 'class-validator';
import { FECHA_MENSAJE, FECHA_REGEX } from '../../common/validaciones.js';

/** Turnos cerrados que se abrieron entre `desde` y `hasta` (YYYY-MM-DD, ambos opcionales). */
export class FiltroTurnosDto {
  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  hasta?: string;
}
