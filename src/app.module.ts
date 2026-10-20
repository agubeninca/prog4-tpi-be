import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { FirebaseModule } from './firebase/firebase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { CategoriasModule } from './categorias/categorias.module.js';
import { ProductosModule } from './productos/productos.module.js';
import { MesasModule } from './mesas/mesas.module.js';
import { MenuModule } from './menu/menu.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { PedidosModule } from './pedidos/pedidos.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { ReportesModule } from './reportes/reportes.module.js';

@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
    AuthModule,
    UsuariosModule,
    CategoriasModule,
    ProductosModule,
    MesasModule,
    MenuModule,
    ClientesModule,
    PedidosModule,
    ReviewsModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
