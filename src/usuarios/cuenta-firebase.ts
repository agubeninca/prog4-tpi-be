// El personal entra con un nombre de usuario (ej. "cocina1", "jperez" o un legajo "1024"),
// pero Firebase Auth (email/contraseña) necesita un email: se usa uno interno que nadie ve.
// Debe coincidir con el del frontend (modules/Auth/services/auth.service.ts).

export const DOMINIO_CUENTAS = 'kitch.local';

/** 3 a 30 caracteres: minúsculas, números, punto, guion y guion bajo. */
export const NOMBRE_USUARIO_REGEX = /^[a-z0-9._-]{3,30}$/;
export const NOMBRE_USUARIO_MENSAJE =
  'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios)';

export function emailInterno(nombreUsuario: string) {
  return `${nombreUsuario}@${DOMINIO_CUENTAS}`;
}
