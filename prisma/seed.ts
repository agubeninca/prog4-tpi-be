import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { PrismaClient, usuario_rol } from '../generated/prisma/client.js';
import { emailInterno } from '../src/usuarios/cuenta-firebase.js';
import { CANTIDAD_MESAS, MENU_EJEMPLO } from './seed-data/menu.js';

// Seed idempotente: se puede correr en cada `npm start` sin duplicar datos.
// - El personal se asegura siempre (sin un ADMIN no se puede entrar al panel).
// - El menú y las mesas de ejemplo se cargan solo si la base no tiene ninguno (ni archivado):
//   así no se vuelve a crear lo que el admin borró o editó.

const PERSONAL = [
  {
    nombre_usuario: 'admin',
    password: 'admin123',
    nombre: 'Administración',
    rol: usuario_rol.ADMIN,
  },
  {
    nombre_usuario: 'cocina',
    password: 'cocina123',
    nombre: 'Cocina',
    rol: usuario_rol.COCINA,
  },
];

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    'Falta FIREBASE_AUTH_EMULATOR_HOST en el .env: el seed solo crea usuarios en el emulador de Auth, nunca en un proyecto real.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const app =
  getApps()[0] ??
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
const auth = getAuth(app);

// ---------- Personal ----------

async function asegurarCuentaFirebase(
  nombreUsuario: string,
  password: string,
  nombre: string,
): Promise<UserRecord> {
  const email = emailInterno(nombreUsuario);
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    const codigo = (error as { code?: unknown } | null)?.code;
    if (codigo !== 'auth/user-not-found') {
      throw new Error(
        `No se pudo consultar el emulador de Auth (${process.env.FIREBASE_AUTH_EMULATOR_HOST}). ¿Está corriendo "npm run emulators"?`,
        { cause: error },
      );
    }
    return auth.createUser({ email, password, displayName: nombre });
  }
}

async function seedPersonal() {
  console.log('Personal:');
  for (const { nombre_usuario, password, nombre, rol } of PERSONAL) {
    const cuenta = await asegurarCuentaFirebase(
      nombre_usuario,
      password,
      nombre,
    );
    await prisma.usuario.upsert({
      where: { nombre_usuario },
      update: { firebase_uid: cuenta.uid, archivado: false },
      create: { firebase_uid: cuenta.uid, nombre_usuario, nombre, rol },
    });
    console.log(
      `  ✔ ${rol.padEnd(6)} usuario: ${nombre_usuario} / contraseña: ${password}`,
    );
  }
}

// ---------- Imágenes de ejemplo (Sharp → Storage) ----------

function puertoAbierto(direccion: string | undefined) {
  const [host, puerto] = (direccion ?? '').split(':');
  if (!host || !puerto) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({
      host,
      port: Number(puerto),
      timeout: 1500,
    });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const escaparXml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Parte el nombre en renglones de hasta ~14 caracteres para que entre en la imagen. */
function renglones(nombre: string) {
  const lineas: string[] = [];
  for (const palabra of nombre.split(' ')) {
    const ultima = lineas.at(-1);
    if (ultima && `${ultima} ${palabra}`.length <= 14) {
      lineas[lineas.length - 1] = `${ultima} ${palabra}`;
    } else {
      lineas.push(palabra);
    }
  }
  return lineas;
}

/** Imagen de ejemplo: el nombre del producto sobre el color de su categoría, en WEBP (igual que las subidas). */
function imagenDeEjemplo(nombre: string, color: string) {
  const lineas = renglones(nombre);
  const alto = 72;
  const inicio = 300 - ((lineas.length - 1) * alto) / 2 + 24;
  const textos = lineas
    .map(
      (linea, i) =>
        `<text x="400" y="${inicio + i * alto}" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff" text-anchor="middle">${escaparXml(linea)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <defs><linearGradient id="sombra" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient></defs>
    <rect width="800" height="600" fill="${color}"/><rect width="800" height="600" fill="url(#sombra)"/>
    ${textos}
    <text x="400" y="560" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.7" text-anchor="middle">Kitch · imagen de ejemplo</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

// ---------- Menú y mesas de ejemplo ----------

async function seedMenu() {
  if ((await prisma.categoria.count()) > 0) {
    console.log(
      'Menú: ya hay categorías cargadas, no se agrega el menú de ejemplo.',
    );
    return;
  }

  const conImagenes = await puertoAbierto(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  );
  const bucket = conImagenes ? getStorage(app).bucket() : null;
  let cantidadProductos = 0;
  let pausados = 0;

  for (const { nombre, descripcion, color, productos } of MENU_EJEMPLO) {
    const categoria = await prisma.categoria.create({
      data: { nombre, descripcion },
    });
    for (const producto of productos) {
      const creado = await prisma.producto.create({
        data: {
          id_categoria: categoria.id_categoria,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio.toFixed(2),
          estado_pausado: producto.pausado ?? false,
        },
      });
      if (bucket) {
        const ruta_imagen = `productos/producto-${creado.id_producto}.webp`;
        await bucket
          .file(ruta_imagen)
          .save(await imagenDeEjemplo(producto.nombre, color), {
            contentType: 'image/webp',
          });
        await prisma.producto.update({
          where: { id_producto: creado.id_producto },
          data: { ruta_imagen },
        });
      }
      cantidadProductos += 1;
      if (producto.pausado) pausados += 1;
    }
  }

  console.log(
    `Menú: ✔ ${MENU_EJEMPLO.length} categorías y ${cantidadProductos} productos (${pausados} pausados para probar RB-02)`,
  );
  if (!bucket) {
    console.log(
      '  ! El emulador de Storage no respondía: los productos quedaron sin imagen (se pueden subir desde el admin).',
    );
  }
}

async function seedMesas() {
  if ((await prisma.mesa.count()) > 0) {
    console.log('Mesas: ya hay mesas cargadas, no se agregan las de ejemplo.');
    return;
  }
  await prisma.mesa.createMany({
    data: Array.from({ length: CANTIDAD_MESAS }, (_, i) => ({
      numero_mesa: i + 1,
      hash_codigo_qr: randomBytes(16).toString('hex'),
    })),
  });
  console.log(
    `Mesas: ✔ ${CANTIDAD_MESAS} mesas (1 a ${CANTIDAD_MESAS}) con su QR`,
  );
}

async function main() {
  await seedPersonal();
  await seedMenu();
  await seedMesas();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
