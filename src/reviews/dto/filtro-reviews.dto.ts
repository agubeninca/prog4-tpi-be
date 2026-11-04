import { IsOptional, IsString, Matches } from 'class-validator';
import {
  DNI_MENSAJE,
  DNI_REGEX,
  FECHA_MENSAJE,
  FECHA_REGEX,
} from '../../common/validaciones.js';

export class FiltroReviewsDto {
  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  hasta?: string;

  /** Solo las reviews de un cliente (por DNI). */
  @IsOptional()
  @Matches(DNI_REGEX, { message: DNI_MENSAJE })
  @IsString()
  dni?: string;
}
