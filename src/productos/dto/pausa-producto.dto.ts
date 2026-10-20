import { IsBoolean } from 'class-validator';

export class PausaProductoDto {
  @IsBoolean()
  estado_pausado: boolean;
}
