import { IsString, Matches } from 'class-validator';
import { DNI_MENSAJE, DNI_REGEX } from '../../common/validaciones.js';

export class ConsultaPedidoClienteDto {
  @IsString()
  @Matches(DNI_REGEX, { message: DNI_MENSAJE })
  dni: string;
}
