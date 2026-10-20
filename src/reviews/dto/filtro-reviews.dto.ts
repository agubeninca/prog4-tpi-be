import { IsOptional, Matches } from 'class-validator';
import { FECHA_MENSAJE, FECHA_REGEX } from '../../common/validaciones.js';

export class FiltroReviewsDto {
  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  hasta?: string;
}
