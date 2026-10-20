import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../firebase/firebase.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestConUsuario } from './auth.types.js';
import { IS_PUBLIC_KEY } from './decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }

    let uid: string;
    try {
      ({ uid } = await this.firebase.auth.verifyIdToken(token));
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { firebase_uid: uid, archivado: false },
      select: {
        id_usuario: true,
        firebase_uid: true,
        email: true,
        nombre: true,
        rol: true,
      },
    });
    if (!usuario) {
      throw new UnauthorizedException('El usuario no está habilitado en Kitch');
    }

    request.user = usuario;
    return true;
  }
}
