import { IsInt, IsPositive } from 'class-validator';
import { OrdenarDto } from '../../common/orden.dto.js';

export class OrdenProductosDto extends OrdenarDto {
  @IsInt()
  @IsPositive()
  id_categoria: number;
}
