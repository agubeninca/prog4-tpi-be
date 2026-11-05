import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { usuario_rol } from '../../../generated/prisma/client.js';
import { Trim } from '../../common/validaciones.js';
import {
  NOMBRE_USUARIO_MENSAJE,
  NOMBRE_USUARIO_REGEX,
} from '../cuenta-firebase.js';

export class CreateUsuarioDto {
  // Se guarda en minúsculas: "JPerez" y "jperez" son el mismo usuario.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(NOMBRE_USUARIO_REGEX, { message: NOMBRE_USUARIO_MENSAJE })
  @IsString({ message: 'El usuario es obligatorio' })
  nombre_usuario: string;

  @MaxLength(64)
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @IsString({ message: 'La contraseña es obligatoria' })
  password: string;

  @Trim()
  @MaxLength(100)
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsEnum(usuario_rol, { message: 'El rol debe ser ADMIN, BARRA o COCINA' })
  rol: usuario_rol;
}
