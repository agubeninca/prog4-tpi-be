import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IdentificarClienteDto } from '../../clientes/dto/identificar-cliente.dto.js';
import { ItemPedidoDto } from './item-pedido.dto.js';

export class CreatePedidoDto extends IdentificarClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  hash_codigo_qr: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'El pedido debe tener al menos un producto' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  items: ItemPedidoDto[];
}
