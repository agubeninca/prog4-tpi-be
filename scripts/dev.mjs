// Arranque de desarrollo con un solo comando (`npm start`), en macOS, Windows y Linux:
// verifica el entorno, migra la base, levanta los emuladores de Firebase, carga el seed y arranca la API.
// Solo usa módulos de Node: nada de comandos propios de bash o de cmd.

import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { execSync, spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const PLATAFORMA = process.platform; // 'darwin' | 'win32' | 'linux'
const NODE_MINIMO = 20;
const JAVA_MINIMO = 11;
const PUERTOS_EMULADORES = { Auth: 9099, Firestore: 8080, Storage: 9199 };
const ESPERA_EMULADORES_MS = 120_000;

/** Binario local de node_modules/.bin (en Windows, el shell resuelve el .cmd). Evita el proceso intermedio de npx. */
const bin = (nombre) => path.join('node_modules', '.bin', nombre);

const color = (codigo) => (texto) => (process.stdout.isTTY ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);
const verde = color(32);
const amarillo = color(33);
const rojo = color(31);
const gris = color(90);

const ok = (msg) => console.log(`${verde('✔')} ${msg}`);
const aviso = (msg) => console.log(`${amarillo('!')} ${msg}`);
function abortar(titulo, ...lineas) {
  console.error(`\n${rojo('✖')} ${titulo}`);
  for (const linea of lineas) console.error(`  ${linea}`);
  console.error('');
  process.exit(1);
}

/** Instrucción distinta según el sistema operativo. */
const segunSO = ({ mac, windows, linux }) => (PLATAFORMA === 'win32' ? windows : PLATAFORMA === 'darwin' ? mac : linux);

// ---------- 1. Node ----------
function verificarNode() {
  const mayor = Number(process.versions.node.split('.')[0]);
  if (mayor < NODE_MINIMO) {
    abortar(
      `Se necesita Node ${NODE_MINIMO} o superior (tenés ${process.versions.node}).`,
      segunSO({
        mac: 'Instalalo con: brew install node   (o desde https://nodejs.org)',
        windows: 'Instalalo desde https://nodejs.org (versión LTS) o con: winget install OpenJS.NodeJS.LTS',
        linux: 'Instalalo desde https://nodejs.org o con el gestor de paquetes de tu distribución',
      }),
    );
  }
  ok(`Node ${process.versions.node}`);
}

// ---------- 2. .env ----------
function leerEnv() {
  const variables = {};
  for (const linea of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (coincidencia) variables[coincidencia[1]] = coincidencia[2].replace(/^["']|["']$/g, '');
  }
  return variables;
}

function asegurarEnv() {
  if (!existsSync('.env')) {
    copyFileSync('.env.example', '.env');
    aviso('No había .env: se creó a partir de .env.example');
  }
  const env = leerEnv();
  const ejemplo = readFileSync('.env.example', 'utf-8')
    .split(/\r?\n/)
    .map((linea) => linea.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean);
  const faltantes = ejemplo.filter((clave) => !(clave in env));
  if (faltantes.length > 0) {
    aviso(`Al .env le faltan variables que sí están en .env.example: ${faltantes.join(', ')}. Copialas de ahí.`);
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.includes('USUARIO:PASSWORD')) {
    abortar(
      'Completá DATABASE_URL en el archivo .env con el usuario y la contraseña de tu MySQL.',
      'Formato: DATABASE_URL="mysql://usuario:contraseña@localhost:3306/kitch"',
      segunSO({
        mac: 'Con MySQL de Homebrew suele ser: mysql://root:TU_PASSWORD@localhost:3306/kitch',
        windows: 'Con XAMPP, el usuario por defecto es root sin contraseña: mysql://root@localhost:3306/kitch',
        linux: 'Ejemplo: mysql://root:TU_PASSWORD@localhost:3306/kitch',
      }),
      'La base "kitch" no hace falta crearla: se crea sola al aplicar las migraciones.',
    );
  }
  ok('.env');
  return env;
}

// ---------- 3. Dependencias ----------
function asegurarDependencias() {
  const marca = 'node_modules/.package-lock.json';
  const desactualizadas = existsSync(marca) && statSync('package-lock.json').mtimeMs > statSync(marca).mtimeMs;
  if (!existsSync('node_modules') || desactualizadas) {
    aviso(desactualizadas ? 'package-lock.json cambió: actualizando dependencias...' : 'Instalando dependencias...');
    execSync('npm install', { stdio: 'inherit' });
  }
  ok('Dependencias instaladas');
}

// ---------- utilidades de red ----------
function puertoAbierto(port, host = '127.0.0.1') {
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

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- 4. MySQL ----------
async function verificarMySQL(databaseUrl) {
  let host = 'localhost';
  let port = 3306;
  try {
    const url = new URL(databaseUrl);
    host = url.hostname || host;
    port = Number(url.port) || port;
  } catch {
    abortar('DATABASE_URL del .env no es una URL válida.', 'Formato: mysql://usuario:contraseña@localhost:3306/kitch');
  }
  if (!(await puertoAbierto(port, host))) {
    abortar(
      `No hay un MySQL escuchando en ${host}:${port}.`,
      segunSO({
        mac: 'Inicialo con: brew services start mysql   (si no lo tenés: brew install mysql)',
        windows:
          'Inicialo desde el panel de XAMPP (botón Start de MySQL) o en "Servicios" de Windows (servicio MySQL80). Si no lo tenés: https://dev.mysql.com/downloads/installer/',
        linux: 'Inicialo con: sudo systemctl start mysql',
      }),
    );
  }
  ok(`MySQL en ${host}:${port}`);
}

// ---------- 5. Migraciones y cliente de Prisma ----------
function prepararBase() {
  try {
    // migrate deploy crea la base si no existe y aplica las migraciones pendientes.
    execSync(`${bin('prisma')} migrate deploy`, { stdio: 'inherit' });
    execSync(`${bin('prisma')} generate`, { stdio: 'inherit' });
  } catch {
    abortar(
      'Falló la preparación de la base de datos (ver el error de Prisma arriba).',
      'Si dice "Authentication failed" o "Access denied": revisá el usuario y la contraseña de DATABASE_URL en .env.',
    );
  }
  ok('Base de datos al día');
}

// ---------- 6. Java + emuladores de Firebase ----------
function verificarJava() {
  const resultado = spawnSync('java', ['-version'], { encoding: 'utf-8' });
  const salida = `${resultado.stderr ?? ''}${resultado.stdout ?? ''}`;
  const coincidencia = salida.match(/version "(\d+)(?:\.(\d+))?/);
  const instalar = segunSO({
    mac: 'Instalalo con: brew install openjdk@21   (y seguí las instrucciones que muestra brew para agregarlo al PATH)',
    windows: 'Instalalo con: winget install EclipseAdoptium.Temurin.21.JDK   (o desde https://adoptium.net) y abrí una terminal nueva',
    linux: 'Instalalo con: sudo apt install openjdk-21-jdk   (o el equivalente de tu distribución)',
  });
  if (resultado.error || !coincidencia) {
    abortar('No se encontró Java. Lo necesita el emulador de Firestore.', instalar);
  }
  const mayor = Number(coincidencia[1]) === 1 ? Number(coincidencia[2]) : Number(coincidencia[1]);
  if (mayor < JAVA_MINIMO) {
    abortar(`Se necesita Java ${JAVA_MINIMO} o superior (tenés Java ${mayor}).`, instalar);
  }
  ok(`Java ${mayor}`);
}

async function estadoEmuladores() {
  const abiertos = await Promise.all(Object.values(PUERTOS_EMULADORES).map((p) => puertoAbierto(p)));
  if (abiertos.every(Boolean)) return 'corriendo';
  if (abiertos.some(Boolean)) {
    const ocupados = Object.entries(PUERTOS_EMULADORES)
      .filter((_, i) => abiertos[i])
      .map(([nombre, puerto]) => `${puerto} (${nombre})`);
    return { ocupados };
  }
  return 'apagados';
}

function prefijarSalida(stream, prefijo) {
  let resto = '';
  stream.setEncoding('utf-8');
  stream.on('data', (trozo) => {
    const lineas = (resto + trozo).split(/\r?\n/);
    resto = lineas.pop() ?? '';
    for (const linea of lineas) if (linea.trim()) console.log(`${gris(prefijo)} ${linea}`);
  });
}

async function levantarEmuladores() {
  const estado = await estadoEmuladores();
  if (estado === 'corriendo') {
    ok('Emuladores de Firebase ya estaban corriendo (no se van a cerrar al salir)');
    return null;
  }
  if (typeof estado === 'object') {
    abortar(
      `Hay puertos de los emuladores ocupados: ${estado.ocupados.join(', ')}.`,
      'Probablemente quedaron emuladores a medio cerrar u otro programa usa esos puertos. Cerralos y volvé a correr npm start.',
    );
  }

  verificarJava();
  console.log('Levantando emuladores de Firebase (la primera vez descargan sus componentes, puede tardar)...');
  const emuladores = spawn(
    `${bin('firebase')} emulators:start --project demo-kitch --import=./firebase-emulator-data --export-on-exit`,
    { shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  prefijarSalida(emuladores.stdout, '[firebase]');
  prefijarSalida(emuladores.stderr, '[firebase]');

  let termino = false;
  emuladores.on('exit', () => {
    termino = true;
  });

  const limite = Date.now() + ESPERA_EMULADORES_MS;
  while (Date.now() < limite) {
    if (termino) abortar('Los emuladores de Firebase se cerraron al arrancar (ver el error de [firebase] arriba).');
    if ((await estadoEmuladores()) === 'corriendo') {
      ok('Emuladores de Firebase listos (UI en http://127.0.0.1:4000)');
      return emuladores;
    }
    await esperar(1000);
  }
  emuladores.kill('SIGINT');
  abortar('Los emuladores de Firebase no terminaron de arrancar a tiempo.');
}

// ---------- 7. Seed ----------
function correrSeed() {
  try {
    // Idempotente: se puede correr en cada arranque sin duplicar datos.
    execSync(`${bin('prisma')} db seed`, { stdio: 'inherit' });
    ok('Seed aplicado');
  } catch {
    aviso('El seed falló (ver arriba). La API arranca igual, pero puede que no haya usuarios para entrar.');
  }
}

// ---------- 8. API + cierre ordenado ----------
function arrancarApi(emuladores) {
  console.log(
    `\n${verde('Kitch')} · API ${verde('http://localhost:3000')} · UI de emuladores ${verde('http://127.0.0.1:4000')}`,
  );
  console.log(gris('Personal de prueba: admin@kitch.local / admin123 · cocina@kitch.local / cocina123'));
  console.log(gris('Ctrl+C para detener todo (los emuladores guardan sus datos al cerrar).\n'));

  const api = spawn(`${bin('nest')} start --watch`, { shell: true, stdio: 'inherit' });
  const hijos = [api, emuladores].filter(Boolean);
  let vivos = hijos.length;
  let cerrando = false;

  const salirCuandoTerminen = () => {
    vivos -= 1;
    if (vivos <= 0) process.exit(0);
  };
  for (const hijo of hijos) hijo.on('exit', salirCuandoTerminen);

  // Si la API se cae, se cierran también los emuladores (guardando sus datos).
  api.on('exit', () => {
    if (!cerrando && emuladores && emuladores.exitCode === null) {
      cerrando = true;
      emuladores.kill('SIGINT');
    }
  });

  // Ctrl+C: la terminal ya le manda la señal a todos los procesos hijos (macOS, Linux y Windows).
  // No se reenvía: un segundo Ctrl+C hace que Firebase cierre SIN exportar los datos.
  process.on('SIGINT', () => {
    if (!cerrando) {
      cerrando = true;
      console.log(gris('\nCerrando... (los emuladores están guardando sus datos)'));
    }
  });
  // SIGTERM no viene de la terminal: ahí sí hay que avisarles a los hijos.
  process.on('SIGTERM', () => {
    cerrando = true;
    for (const hijo of hijos) if (hijo.exitCode === null) hijo.kill('SIGINT');
  });
}

async function main() {
  console.log(`Kitch backend · ${segunSO({ mac: 'macOS', windows: 'Windows', linux: 'Linux' })}\n`);
  verificarNode();
  const env = asegurarEnv();
  asegurarDependencias();
  await verificarMySQL(env.DATABASE_URL);
  prepararBase();
  const emuladores = await levantarEmuladores();
  correrSeed();
  arrancarApi(emuladores);
}

main();
