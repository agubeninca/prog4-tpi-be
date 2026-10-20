import type { Request } from 'express';
import type { usuario_rol } from '../../generated/prisma/client.js';

export interface UsuarioAutenticado {
  id_usuario: number;
  firebase_uid: string;
  email: string;
  nombre: string;
  rol: usuario_rol;
}

export interface RequestConUsuario extends Request {
  user?: UsuarioAutenticado;
}
