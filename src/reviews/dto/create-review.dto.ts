import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DNI_MENSAJE, DNI_REGEX, Trim } from '../../common/validaciones.js';

export class CreateReviewDto {
  @Trim()
  @IsString()
  @Matches(DNI_REGEX, { message: DNI_MENSAJE })
  dni: string;

  @IsInt()
  @Min(1, { message: 'La puntuación va de 1 a 5' })
  @Max(5, { message: 'La puntuación va de 1 a 5' })
  puntuacion: number;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
