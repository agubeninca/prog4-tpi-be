import { Controller, Get } from '@nestjs/common';
import type { UsuarioAutenticado } from './auth.types.js';
import { UsuarioActual } from './decorators.js';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@UsuarioActual() usuario: UsuarioAutenticado) {
    return usuario;
  }
}
