import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { MenuService } from './menu.service.js';

@Controller('menu')
@Public()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  obtenerMenu() {
    return this.menuService.obtenerMenu();
  }
}
