import { IsString, Matches } from 'class-validator';
import { DNI_MENSAJE, DNI_REGEX } from '../../common/validaciones.js';

export class DniParamDto {
  @Matches(DNI_REGEX, { message: DNI_MENSAJE })
  @IsString()
  dni: string;
}
