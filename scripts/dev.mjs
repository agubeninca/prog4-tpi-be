import { existsSync, readFileSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import net from 'node:net';

function asegurarDependencias() {
  if (!existsSync('node_modules')) {
    console.log('Dependencias no instaladas, corriendo npm install...');
    execSync('npm install', { stdio: 'inherit' });
  } else {
    console.log('Dependencias ya instaladas.');
  }
}

function leerDatabaseUrlDelEnv() {
  if (!existsSync('.env')) {
    return undefined;
  }
  const contenido = readFileSync('.env', 'utf-8');
  const linea = contenido.split('\n').find((l) => l.trim().startsWith('DATABASE_URL='));
  if (!linea) {
    return undefined;
  }
  return linea.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

function obtenerHostYPuerto() {
  const url = leerDatabaseUrlDelEnv();
  if (!url) {
    return { host: 'localhost', port: 3306 };
  }
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname || 'localhost', port: Number(parsed.port) || 3306 };
  } catch {
    return { host: 'localhost', port: 3306 };
  }
}

function verificarBaseDeDatos({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1500 });
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

async function main() {
  asegurarDependencias();

  const { host, port } = obtenerHostYPuerto();
  const dbArriba = await verificarBaseDeDatos({ host, port });
  if (!dbArriba) {
    console.error(`\nNo se pudo conectar a MySQL en ${host}:${port}.`);
    console.error(
      'Iniciá tu servidor de MySQL local antes de continuar (Servicios de Windows, XAMPP, brew services, Docker, etc.) y volvé a correr "npm start".\n',
    );
    process.exit(1);
  }
  console.log(`MySQL detectado en ${host}:${port}.`);

  console.log('Aplicando migraciones pendientes...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Generando cliente de Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  const child = spawn('npx nest start --watch', { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
