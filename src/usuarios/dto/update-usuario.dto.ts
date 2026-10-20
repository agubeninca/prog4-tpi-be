import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto.js';

// El email identifica la cuenta en Firebase Auth: no se edita.
export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['email'] as const),
) {}
