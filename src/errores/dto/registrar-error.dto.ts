import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Error reportado por el frontend (endpoint público: también lo usa la Vista Cliente). */
export class RegistrarErrorDto {
  @MaxLength(1000)
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  @IsString({ message: 'El mensaje es obligatorio' })
  mensaje: string;

  @IsOptional()
  @MaxLength(10000)
  @IsString()
  stack?: string;

  @IsOptional()
  @MaxLength(500)
  @IsString()
  contexto?: string;
}
