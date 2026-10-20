import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class FiltroProductosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id_categoria?: number;
}
