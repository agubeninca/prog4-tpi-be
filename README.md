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
5. Corre el seed (idempotente) y arranca la API en http://localhost:3000. Con la base vacía, carga un menú de ejemplo de cafetería y 6 mesas.

**Ctrl+C** cierra todo, y los emuladores guardan su estado en `firebase-emulator-data/`. El proyecto Firebase es `demo-kitch` (prefijo `demo-`): no hace falta cuenta ni `firebase login`. Si preferís tener los emuladores en otra terminal, corré `npm run emulators` antes: `npm start` los detecta y los usa.

### Usuarios de prueba (seed)

| Rol | Usuario | Contraseña |
|---|---|---|
| ADMIN | `admin` | `admin123` |
| BARRA | `barra` | `barra123` |
| COCINA | `cocina` | `cocina123` |

**Roles:** ADMIN accede a todo. BARRA usa el panel de comandas, cambia los estados (tomar, servido, cancelar) y puede cargar comandas a mano para clientes que no usan el QR (quedan en el registro de comandas manuales). COCINA ve el mismo panel en tiempo real pero solo lectura, para saber qué preparar.

**Mozos:** no inician sesión. Al cargar una comanda a mano se elige el mozo que atiende la mesa, y la mesa queda a su nombre hasta que todos sus pedidos estén pagados o cancelados (mientras tanto, otro mozo no puede cargarle comandas). El seed precarga 4 de ejemplo (Juan, María, Lucas y Sofía), que se editan desde la pestaña **Mozos** del panel de Admin.

## Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/mesas/qr/:hash` | Público |
| GET | `/menu` | Público |
| GET | `/clientes/consulta/:dni` | Público (¿DNI registrado? + nombre enmascarado "A*** B***") |
| POST | `/clientes/identificar` | Público (crea el cliente; si ya existe no pisa ni devuelve el nombre) |
| POST | `/pedidos` | Público |
| GET | `/pedidos/:id?dni=` | Público (solo con el DNI del pedido) |
| POST | `/pedidos/:id/reviews` | Público (solo con el DNI del pedido) |
| GET | `/pedidos?estado=&pagado=&fecha=&desde=&hasta=&q=&numero_mesa=` | ADMIN, BARRA, COCINA (historial; hasta 500, más nuevos primero; `q` busca por nombre o DNI del cliente y por nombre o CUIT de la cuenta) |
| POST | `/pedidos/manual` | ADMIN, BARRA (comanda cargada a mano: `id_mesa`, `id_mozo`, `dni`, `nombre?`, `items`, `observacion?`. La mesa queda a nombre de ese mozo mientras tenga pedidos sin pagar ni cancelar: si la atiende otro mozo, responde 409) |
| GET | `/pedidos/manuales?desde=&hasta=` | ADMIN, BARRA (registro de comandas manuales: horario, detalle y quién la cargó) |
| GET | `/mesas/activas` | ADMIN, BARRA (mesas habilitadas, para la carga manual, con el `mozo` que las atiende o `null` si están libres) |
| GET | `/mozos` | ADMIN, BARRA (mozos activos e inactivos, con `mesas_atendiendo`) |
| POST / PATCH / DELETE | `/mozos`, `/mozos/:id` | ADMIN (`nombre`, `activo?`; no se puede desactivar ni eliminar un mozo que está atendiendo mesas) |
| GET | `/pedidos/mios?dni=` | Público (solo con el DNI: los últimos 10 pedidos no cancelados del cliente, para "Mis pedidos" / "Pedir de nuevo") |
| GET (SSE) | `/pedidos/:id/eventos?dni=` | Público (solo con el DNI del pedido; Server-Sent Events: el cliente se entera al instante de cada cambio de estado; se cierra solo al llegar a SERVIDO o CANCELADO) |
| GET | `/pedidos/:id/historial` | ADMIN, BARRA (quién cambió cada estado y cuándo; el alta por QR figura sin usuario) |
| PATCH | `/pedidos/:id/estado` | ADMIN, BARRA (COCINA solo visualiza el panel). Transiciones: PENDIENTE → EN_PREPARACION o CANCELADO; EN_PREPARACION → SERVIDO, CANCELADO o **PENDIENTE** (volver atrás un pedido pasado por error); SERVIDO y CANCELADO son finales |
| PATCH | `/pedidos/:id/pago` | ADMIN, BARRA (`{ "pagado": "PENDIENTE" \| "PAGADO", "medio_pago"?, "facturacion"?, "cuenta_nombre"?, "cuenta_cuit"? }`; el medio es obligatorio al marcarlo pagado: EFECTIVO, DEBITO, CREDITO, MERCADO_PAGO, TRANSFERENCIA o CUENTA_CORRIENTE. `facturacion`: CONSUMIDOR_FINAL (por defecto) o CUENTA; con CUENTA, `cuenta_nombre` (nombre o razón social) es obligatorio y `cuenta_cuit` opcional (11 dígitos, con o sin guiones). Pagado, se puede volver a llamar para corregir el cobro; al volverlo a pendiente se borran esos datos. Un pedido cancelado no se puede marcar como pagado) |
| CRUD | `/categorias`, `/productos`, `/mesas`, `/usuarios` | ADMIN |
| GET | `/clientes?q=` · `/clientes/:dni` | ADMIN (listado con métricas · ficha con pedidos y reviews) |
| PATCH | `/clientes/:dni` | ADMIN (corregir el nombre) |
| DELETE | `/clientes/:dni` | ADMIN (solo clientes sin pedidos; con pedidos → 409) |
| PATCH | `/productos/:id/pausa` · POST `/productos/:id/imagen` · DELETE `/productos/:id/imagen` | ADMIN (el DELETE deja el producto sin imagen) |
| PUT | `/categorias/orden` · `/productos/orden` | ADMIN (orden del menú: `{ "ids": [...] }` con TODAS las categorías; `{ "id_categoria", "ids": [...] }` con TODOS los productos de esa categoría) |
| POST | `/mesas/:id/regenerar-qr` | ADMIN |
| GET | `/reviews?desde=&hasta=&dni=` · `/reportes/ventas-dia?fecha=` | ADMIN |
| GET | `/reportes/cierre-caja?fecha=` | ADMIN, BARRA (cobrado del día por medio de pago —por la fecha en que se cobró—, efectivo que debe haber en la caja, facturado a cuentas, servidos sin cobrar de cualquier día, en curso y cancelados) |
| GET | `/reportes/estadisticas?dias=7\|30\|90` | ADMIN (ventas por día y por hora, top 10 de productos y ventas por mozo; cuenta solo pedidos servidos) |
| DELETE | `/reviews/:id` | ADMIN (borrado definitivo de una review) |
| POST | `/errores` | Público (el frontend reporta sus errores; se guardan en Firestore) |
| GET · DELETE | `/errores?tipo=&limite=` | ADMIN (listar / vaciar el log de errores) |
| GET | `/auth/me` | Personal logueado |

Los endpoints protegidos esperan `Authorization: Bearer <ID token de Firebase>`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm start` | Arranque completo: verificaciones, migraciones, emuladores, seed y API con watch |
| `npm run emulators` | Solo los emuladores (opcional, en otra terminal) |
| `npm run prisma:seed` | Seed idempotente: personal siempre; menú de ejemplo (5 categorías, 21 productos con imagen) y 6 mesas solo si la base no tiene ninguna |
| `npm run build` / `npm run lint` | Compilación / ESLint + Prettier |
