import { IsInt, IsPositive, Max, Min } from 'class-validator';

// Solo producto y cantidad: el precio lo pone siempre el backend.
export class ItemPedidoDto {
  @IsInt()
  @IsPositive()
  id_producto: number;

  @IsInt()
  @Min(1)
  @Max(50)
  cantidad: number;
}
