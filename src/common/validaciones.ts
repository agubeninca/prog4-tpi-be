import { Transform } from 'class-transformer';

export const DNI_REGEX = /^\d{7,8}$/;
export const DNI_MENSAJE = 'El DNI debe tener 7 u 8 dígitos, sin puntos';

export const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const FECHA_MENSAJE = 'La fecha debe tener el formato AAAA-MM-DD';

/** Quita espacios al principio y al final de los textos recibidos. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
