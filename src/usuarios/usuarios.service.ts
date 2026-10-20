import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { usuario_rol } from '../../generated/prisma/client.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/auth.types.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async create({ email, password, nombre, rol }: CreateUsuarioDto) {
    const registro = await this.firebase.auth
      .createUser({ email, password, displayName: nombre })
      .catch((error: unknown) => {
        if (codigoFirebase(error) === 'auth/email-already-exists') {
          throw new ConflictException('Ya existe un usuario con ese email');
        }
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'No se pudo crear el usuario',
        );
      });

    try {
      return await this.prisma.usuario.create({
        data: { firebase_uid: registro.uid, email, nombre, rol },
      });
    } catch (error) {
      // Sin la fila en MySQL la cuenta no sirve: se borra para no dejarla huérfana.
      await this.firebase.auth.deleteUser(registro.uid);
      throw error;
    }
  }

  findAll() {
    return this.prisma.usuario.findMany({
      where: { archivado: false },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id_usuario: id, archivado: false },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario #${id} no encontrado`);
    }
    return usuario;
  }

  async update(
    id: number,
    { password, nombre, rol }: UpdateUsuarioDto,
    actual: UsuarioAutenticado,
  ) {
    const usuario = await this.findOne(id);
    if (id === actual.id_usuario && rol && rol !== usuario_rol.ADMIN) {
      throw new BadRequestException(
        'No podés quitarte el rol de administrador',
      );
    }

    if (password || nombre) {
      await this.firebase.auth.updateUser(usuario.firebase_uid, {
        ...(password && { password }),
        ...(nombre && { displayName: nombre }),
      });
    }

    return this.prisma.usuario.update({
      where: { id_usuario: id },
      data: { nombre, rol },
    });
  }

  async remove(id: number, actual: UsuarioAutenticado) {
    if (id === actual.id_usuario) {
      throw new BadRequestException('No podés eliminar tu propio usuario');
    }
    const usuario = await this.findOne(id);
    await this.firebase.auth.updateUser(usuario.firebase_uid, {
      disabled: true,
    });
    return this.prisma.usuario.update({
      where: { id_usuario: id },
      data: { archivado: true },
    });
  }
}

function codigoFirebase(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}
