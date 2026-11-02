// Datos de ejemplo: una cafetería / "al paso" (estación de servicio, bar).
// Se cargan solo en una base sin categorías ni mesas (ver prisma/seed.ts).

export interface ProductoEjemplo {
  nombre: string;
  descripcion?: string;
  precio: number;
  /** Pausado por "falta de stock" para probar RB-02 (no aparece en el menú). */
  pausado?: boolean;
}

export interface CategoriaEjemplo {
  nombre: string;
  descripcion: string;
  /** Color de fondo de las imágenes generadas para sus productos. */
  color: string;
  productos: ProductoEjemplo[];
}

export const MENU_EJEMPLO: CategoriaEjemplo[] = [
  {
    nombre: 'Cafetería',
    descripcion: 'Café de especialidad e infusiones',
    color: '#6f4e37',
    productos: [
      { nombre: 'Café espresso', descripcion: 'Corto e intenso', precio: 2200 },
      {
        nombre: 'Cortado',
        descripcion: 'Espresso con un toque de leche',
        precio: 2500,
      },
      {
        nombre: 'Café con leche',
        descripcion: 'Taza grande con leche espumada',
        precio: 2900,
      },
      {
        nombre: 'Capuccino',
        descripcion: 'Con espuma de leche y cacao',
        precio: 3300,
      },
      {
        nombre: 'Lágrima',
        descripcion: 'Leche caliente con un toque de café',
        precio: 2600,
      },
      {
        nombre: 'Té en hebras',
        descripcion: 'Negro, verde o manzanilla',
        precio: 2000,
      },
    ],
  },
  {
    nombre: 'Bebidas frías',
    descripcion: 'Aguas, gaseosas, jugos y licuados',
    color: '#1677ff',
    productos: [
      {
        nombre: 'Agua mineral 500 ml',
        descripcion: 'Con o sin gas',
        precio: 1500,
      },
      {
        nombre: 'Gaseosa 500 ml',
        descripcion: 'Cola, lima-limón o naranja',
        precio: 2000,
      },
      {
        nombre: 'Jugo de naranja',
        descripcion: 'Exprimido en el momento',
        precio: 3000,
      },
      {
        nombre: 'Licuado de banana',
        descripcion: 'Con leche o con agua',
        precio: 3500,
        pausado: true,
      },
    ],
  },
  {
    nombre: 'Pastelería',
    descripcion: 'Facturas y tortas del día',
    color: '#d48806',
    productos: [
      { nombre: 'Medialuna de manteca', precio: 1000 },
      { nombre: 'Medialuna de grasa', precio: 900 },
      {
        nombre: 'Alfajor de maicena',
        descripcion: 'Con dulce de leche y coco',
        precio: 1500,
      },
      { nombre: 'Budín de limón', descripcion: 'Porción', precio: 2200 },
      {
        nombre: 'Torta de chocolate',
        descripcion: 'Porción',
        precio: 3800,
        pausado: true,
      },
    ],
  },
  {
    nombre: 'Sándwiches y tostados',
    descripcion: 'Para acompañar o almorzar al paso',
    color: '#389e0d',
    productos: [
      {
        nombre: 'Tostado de jamón y queso',
        descripcion: 'En pan de miga',
        precio: 5200,
      },
      {
        nombre: 'Sándwich de miga triple',
        descripcion: 'Jamón, queso y tomate',
        precio: 4500,
      },
      {
        nombre: 'Wrap de pollo',
        descripcion: 'Con lechuga, tomate y aderezo',
        precio: 6500,
      },
    ],
  },
  {
    nombre: 'Combos',
    descripcion: 'Precio especial',
    color: '#c41d7f',
    productos: [
      {
        nombre: 'Desayuno clásico',
        descripcion: 'Café con leche + 2 medialunas',
        precio: 4500,
      },
      {
        nombre: 'Merienda',
        descripcion: 'Capuccino + porción de budín',
        precio: 5000,
      },
      {
        nombre: 'Almuerzo al paso',
        descripcion: 'Tostado + gaseosa 500 ml',
        precio: 6800,
      },
    ],
  },
];

export const CANTIDAD_MESAS = 6;
