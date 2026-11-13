import { Module } from '@nestjs/common';
import { MozosController } from './mozos.controller.js';
import { MozosService } from './mozos.service.js';

@Module({
  controllers: [MozosController],
  providers: [MozosService],
})
export class MozosModule {}
