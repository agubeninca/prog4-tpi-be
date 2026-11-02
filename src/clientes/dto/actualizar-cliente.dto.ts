import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/validaciones.js';

/** El admin corrige el nombre de un cliente (desde la mesa no se puede cambiar). */
export class ActualizarClienteDto {
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
