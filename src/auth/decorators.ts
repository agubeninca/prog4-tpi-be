import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { usuario_rol } from '../../generated/prisma/client.js';
import type { RequestConUsuario, UsuarioAutenticado } from './auth.types.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Ruta accesible sin token (Vista Cliente). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Roles del personal habilitados para la ruta o el controller. */
export const Roles = (...roles: usuario_rol[]) => SetMetadata(ROLES_KEY, roles);

/** Usuario del personal que hizo el request (lo carga AuthGuard). */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    return request.user!;
  },
);
