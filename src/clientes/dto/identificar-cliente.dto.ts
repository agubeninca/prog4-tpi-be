import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { DNI_MENSAJE, DNI_REGEX, Trim } from '../../common/validaciones.js';

export class IdentificarClienteDto {
  @Trim()
  @IsString()
  @Matches(DNI_REGEX, { message: DNI_MENSAJE })
  dni: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;
}
