# Kitch – Backend

API de **Kitch**, menú digital y pedidos desde la mesa (TP Integrador · Programación IV · UTN FRRa 2026).

**Stack:** NestJS 11 · MySQL + Prisma 6 · Firebase (Auth, Firestore y Storage en emuladores) con `firebase-admin` · Sharp · decimal.js · dayjs.

## Requisitos (macOS, Windows o Linux)

- **Node ≥ 20**
- **MySQL** corriendo (macOS: `brew install mysql` · Windows: XAMPP o MySQL Installer)
- **Java ≥ 11**, para el emulador de Firestore (macOS: `brew install openjdk@21` · Windows: `winget install EclipseAdoptium.Temurin.21.JDK`)

No hace falta crear la base ni instalar nada de Firebase: lo hace el arranque.

## Arranque: un solo comando

```bash
npm start
```

La primera vez crea el `.env` y te pide completar `DATABASE_URL` con el usuario y la contraseña de MySQL (en `.env.example` hay ejemplos para macOS, XAMPP y MySQL 8). Después, cada `npm start`:

1. Verifica Node, el `.env`, MySQL y Java, y si falta algo dice cómo instalarlo según tu sistema.
2. Instala dependencias si faltan o cambiaron.
3. Aplica las migraciones (crea la base `kitch` si no existe) y genera el cliente de Prisma.
4. Levanta los emuladores de Firebase (Auth :9099 · Firestore :8080 · Storage :9199 · UI :4000) y espera a que estén listos.
5. Corre el seed (idempotente) y arranca la API en http://localhost:3000.

**Ctrl+C** cierra todo, y los emuladores guardan su estado en `firebase-emulator-data/`. El proyecto Firebase es `demo-kitch` (prefijo `demo-`): no hace falta cuenta ni `firebase login`. Si preferís tener los emuladores en otra terminal, corré `npm run emulators` antes: `npm start` los detecta y los usa.

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
| `npm start` | Arranque completo: verificaciones, migraciones, emuladores, seed y API con watch |
| `npm run emulators` | Solo los emuladores (opcional, en otra terminal) |
| `npm run prisma:seed` | Seed idempotente (por ahora, solo el personal) |
| `npm run build` / `npm run lint` | Compilación / ESLint + Prettier |
