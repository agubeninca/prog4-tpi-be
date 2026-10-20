import 'dotenv/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { PrismaClient, usuario_rol } from '../generated/prisma/client.js';

// Seed idempotente: se puede correr varias veces sin duplicar datos.
// Por ahora carga solo al personal (sin un ADMIN inicial no se puede entrar al panel).
// Pendiente: categorías, productos y mesas.

const PERSONAL = [
  {
    email: 'admin@kitch.local',
    password: 'admin123',
    nombre: 'Administración',
    rol: usuario_rol.ADMIN,
  },
  {
    email: 'cocina@kitch.local',
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
  getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
const auth = getAuth(app);

async function asegurarCuentaFirebase(
  email: string,
  password: string,
  nombre: string,
): Promise<UserRecord> {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    const codigo =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined;
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
  for (const { email, password, nombre, rol } of PERSONAL) {
    const cuenta = await asegurarCuentaFirebase(email, password, nombre);
    await prisma.usuario.upsert({
      where: { email },
      update: { firebase_uid: cuenta.uid, archivado: false },
      create: { firebase_uid: cuenta.uid, email, nombre, rol },
    });
    console.log(`  ✔ ${rol.padEnd(6)} ${email} / ${password}`);
  }
}

async function main() {
  console.log('Seed de personal:');
  await seedPersonal();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
