import { IsEnum, IsOptional, Matches } from 'class-validator';
import { pedido_estado } from '../../../generated/prisma/client.js';
import { FECHA_MENSAJE, FECHA_REGEX } from '../../common/validaciones.js';

export class FiltroPedidosDto {
  @IsOptional()
  @IsEnum(pedido_estado)
  estado?: pedido_estado;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MENSAJE })
  fecha?: string;
}
