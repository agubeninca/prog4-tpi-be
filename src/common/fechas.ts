import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

/**
 * Rango [00:00, 23:59:59.999] de un día en la zona horaria del servidor (TZ del .env).
 * Sin fecha, toma el día de hoy.
 */
export function rangoDelDia(fecha?: string) {
  // Parseo estricto: "2026-13-40" es inválida (sin modo estricto dayjs la desborda a otro día).
  const dia = fecha ? dayjs(fecha, 'YYYY-MM-DD', true) : dayjs();
  if (!dia.isValid()) {
    throw new BadRequestException('La fecha indicada no es válida');
  }
  return {
    fecha: dia.format('YYYY-MM-DD'),
    desde: dia.startOf('day').toDate(),
    hasta: dia.endOf('day').toDate(),
  };
}
