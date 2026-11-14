import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const PERIODOS_ESTADISTICAS = [7, 30, 90];

export class FiltroEstadisticasDto {
  /** Cantidad de días hacia atrás, contando hoy. */
  @IsOptional()
  @Type(() => Number)
  @IsIn(PERIODOS_ESTADISTICAS, {
    message: 'El período debe ser de 7, 30 o 90 días',
  })
  dias?: number;
}
