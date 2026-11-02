import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto.js';

// El nombre de usuario identifica la cuenta en Firebase Auth: no se edita.
export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['nombre_usuario'] as const),
) {}
