import { IsEnum } from 'class-validator';
import { pedido_pago } from '../../../generated/prisma/client.js';

export class CambiarPagoPedidoDto {
  @IsEnum(pedido_pago)
  pagado: pedido_pago;
}
