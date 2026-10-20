# Kitch – Backend

API de **Kitch**, menú digital y pedidos desde la mesa (TP Integrador · Programación IV · UTN FRRa 2026).

**Stack:** NestJS 11 · MySQL + Prisma 6 · Firebase (Auth, Firestore y Storage en emuladores) con `firebase-admin` · Sharp · decimal.js · dayjs.

## Requisitos

- Node ≥ 20
- MySQL corriendo en `localhost:3306`
- Java 17+ (para el emulador de Firestore)

## Primer arranque

```bash
npm install
cp .env.example .env          # completar usuario y contraseña de MySQL en DATABASE_URL
npm run emulators             # terminal 1: Auth :9099 · Firestore :8080 · Storage :9199 · UI :4000
npm start                     # terminal 2: migraciones + cliente Prisma + API en :3000 (watch)
npm run prisma:seed           # una vez, con los emuladores arriba: crea el personal
```

El proyecto Firebase es `demo-kitch` (prefijo `demo-`): los emuladores no necesitan cuenta ni `firebase login`. El estado de los emuladores se guarda en `firebase-emulator-data/` al cerrarlos con Ctrl+C.

### Usuarios de prueba (seed)

| Rol | Email | Contraseña |
|---|---|---|
| ADMIN | `admin@kitch.local` | `admin123` |
| COCINA | `cocina@kitch.local` | `cocina123` |

## Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/mesas/qr/:hash` | Público |
| GET | `/menu` | Público |
| POST | `/clientes/identificar` | Público |
| POST | `/pedidos` | Público |
| GET | `/pedidos/:id?dni=` | Público (solo con el DNI del pedido) |
| POST | `/pedidos/:id/reviews` | Público (solo con el DNI del pedido) |
| GET | `/pedidos?estado=&fecha=` | ADMIN, COCINA |
| PATCH | `/pedidos/:id/estado` | ADMIN, COCINA |
| CRUD | `/categorias`, `/productos`, `/mesas`, `/usuarios` | ADMIN |
| PATCH | `/productos/:id/pausa` · POST `/productos/:id/imagen` | ADMIN |
| POST | `/mesas/:id/regenerar-qr` | ADMIN |
| GET | `/reviews` · `/reportes/ventas-dia?fecha=` | ADMIN |
| GET | `/auth/me` | Personal logueado |

Los endpoints protegidos esperan `Authorization: Bearer <ID token de Firebase>`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm start` | Verifica MySQL, aplica migraciones, genera el cliente y levanta con watch |
| `npm run emulators` | Emuladores de Firebase con import/export de datos |
| `npm run prisma:seed` | Seed idempotente (por ahora, solo el personal) |
| `npm run build` / `npm run lint` | Compilación / ESLint + Prettier |
