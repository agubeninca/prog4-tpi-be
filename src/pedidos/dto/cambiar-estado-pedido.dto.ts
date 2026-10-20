import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { pedido_estado } from '../../../generated/prisma/client.js';
import { Trim } from '../../common/validaciones.js';

export class CambiarEstadoPedidoDto {
  @IsEnum(pedido_estado)
  estado: pedido_estado;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo_cancelacion?: string;
}
