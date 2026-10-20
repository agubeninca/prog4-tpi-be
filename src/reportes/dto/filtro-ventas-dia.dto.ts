import { IsOptional, Matches } from 'class-validator';
import { FECHA_MENSAJE, FECHA_REGEX } from '../../common/validaciones.js';

export class FiltroVentasDiaDto {
  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  fecha?: string;
}
