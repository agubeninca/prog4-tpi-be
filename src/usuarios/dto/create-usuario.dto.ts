import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { usuario_rol } from '../../../generated/prisma/client.js';
import { Trim } from '../../common/validaciones.js';

export class CreateUsuarioDto {
  @Trim()
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(64)
  password: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsEnum(usuario_rol)
  rol: usuario_rol;
}
