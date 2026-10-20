import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

// El hash_codigo_qr nunca viene del cliente: lo genera el backend.
export class CreateMesaDto {
  @IsInt()
  @Min(1)
  @Max(999)
  numero_mesa: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
