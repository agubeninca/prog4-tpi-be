import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { TipoSistema } from '../errores.service.js';

export class FiltroErroresDto {
  @IsOptional()
  @IsIn(['backend', 'frontend'], {
    message: 'El tipo debe ser backend o frontend',
  })
  tipo?: TipoSistema;

  @IsOptional()
  @Type(() => Number)
  @Max(500)
  @Min(1)
  @IsInt()
  limite?: number;
}
