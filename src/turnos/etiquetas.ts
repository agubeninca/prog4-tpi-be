import dayjs from 'dayjs';
import { turno_nombre } from '../../generated/prisma/client.js';

export const ETIQUETA_TURNO: Record<turno_nombre, string> = {
  MANANA: 'mañana',
  TARDE: 'tarde',
  NOCHE: 'noche',
};

/** "turno tarde del 16/11 (desde las 15:02)" */
export function describirTurno(turno: {
  nombre: turno_nombre;
  fecha_apertura: Date;
}) {
  const apertura = dayjs(turno.fecha_apertura);
  return `turno ${ETIQUETA_TURNO[turno.nombre]} del ${apertura.format('DD/MM')} (desde las ${apertura.format('HH:mm')})`;
}
