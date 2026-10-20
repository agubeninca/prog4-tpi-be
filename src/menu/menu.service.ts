import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  /** Menú de la Vista Cliente: solo productos vigentes y no pausados (RB-02, RF-07). */
  async obtenerMenu() {
    const categorias = await this.prisma.categoria.findMany({
      where: { archivado: false },
      orderBy: { nombre: 'asc' },
      select: {
        id_categoria: true,
        nombre: true,
        descripcion: true,
        producto: {
          where: { archivado: false, estado_pausado: false },
          orderBy: { nombre: 'asc' },
          select: {
            id_producto: true,
            nombre: true,
            descripcion: true,
            precio: true,
            ruta_imagen: true,
            fecha_actualizacion: true,
          },
        },
      },
    });

    return categorias
      .filter((categoria) => categoria.producto.length > 0)
      .map(({ producto, ...categoria }) => ({
        ...categoria,
        productos: producto,
      }));
  }
}
