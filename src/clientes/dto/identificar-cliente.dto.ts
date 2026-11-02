import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DNI_MENSAJE, DNI_REGEX, Trim } from '../../common/validaciones.js';

// Con stopAtFirstError, class-validator corta en la primera regla que falla y las ejecuta
// de abajo hacia arriba: por eso la regla más básica (es texto / no está vacío) va al final.
export class IdentificarClienteDto {
  @Trim()
  @Matches(DNI_REGEX, { message: DNI_MENSAJE })
  @IsNotEmpty({ message: 'El DNI es obligatorio' })
  @IsString({ message: 'El DNI es obligatorio' })
  dni: string;

  // Se guarda en cliente.nombre (DER): nombre y apellido en un solo campo.
  // El mínimo se cuenta después del trim, así "  ab  " no pasa.
  @Trim()
  @MaxLength(100, {
    message: 'El nombre y apellido no puede superar los 100 caracteres',
  })
  @MinLength(3, {
    message: 'El nombre y apellido debe tener al menos 3 caracteres',
  })
  @IsNotEmpty({ message: 'El nombre y apellido es obligatorio' })
  @IsString({ message: 'El nombre y apellido es obligatorio' })
  nombre: string;
}
