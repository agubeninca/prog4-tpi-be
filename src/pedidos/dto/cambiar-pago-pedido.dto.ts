import { IsEnum, ValidateIf } from 'class-validator';
import {
  pedido_medio_pago,
  pedido_pago,
} from '../../../generated/prisma/client.js';

export class CambiarPagoPedidoDto {
  @IsEnum(pedido_pago)
  pagado: pedido_pago;

  /** Obligatorio al marcarlo como pagado (queda como registro histórico). */
  @ValidateIf((dto: CambiarPagoPedidoDto) => dto.pagado === pedido_pago.PAGADO)
  @IsEnum(pedido_medio_pago, { message: 'Elegí el medio de pago' })
  medio_pago?: pedido_medio_pago;
}
