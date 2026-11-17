import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { turno_nombre } from '../../../generated/prisma/client.js';

export class AbrirTurnoDto {
  @IsEnum(turno_nombre, { message: 'Elegí el turno: mañana, tarde o noche' })
  nombre: turno_nombre;

  /** Fondo de caja con el que arranca el turno (puede ser 0). */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El efectivo inicial debe ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El efectivo inicial no puede ser negativo' })
  @Max(99999999.99)
  efectivo_inicial: number;
}
