# jmelectricista

Sistema operativo de JM Electricista para gestionar trabajos de campo:
clientes, agenda/capacidad, materiales, stock, proveedores y cotizaciones. El
eje del producto es el `Trabajo` — no un calendario convencional: un trabajo
puede dividirse en múltiples sesiones, requiere materiales que se comparan
contra el stock real, y de ahí sale una cotización con PDF de marca.

Modelado desde el inicio como **multi-organización**: nada del dominio (tipos
de trabajo, estados, horarios laborales, categorías/unidades de materiales)
está hardcodeado, para poder reutilizar la misma base con otros oficios.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) (PostgreSQL, Auth, RLS, Storage)
- [@react-pdf/renderer](https://react-pdf.org) para el PDF de cotización
- Despliegue en [Vercel](https://vercel.com)

## Identidad de marca

El logo oficial vive en `public/brand/jm-electricista-logo.jpg` (sin recortar
ni recolorear) y la paleta está centralizada como variables CSS en
`src/app/globals.css` (`--primary` = Primary Dark #292633, `--accent` =
Electric Yellow #ECCE54, más `--success`/`--warning`/`--info` como colores
semánticos separados de la identidad visual). Los mismos valores hexadecimales
están espejados en `src/lib/brand.ts` para el PDF de cotización, que no puede
leer variables CSS. El amarillo de marca se usa con moderación (indicador de
ítem activo en el sidebar, acentos), nunca para estados de alerta reales.

## Requisitos

- Node.js 20.9+
- Una cuenta/proyecto de [Supabase](https://supabase.com) (o el CLI de Supabase
  con Docker para desarrollo local)

## Instalación

```bash
npm install
cp .env.example .env.local
```

Completá `.env.local` con los datos de tu proyecto de Supabase (ver abajo).

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima/pública del proyecto. Segura para el navegador: el acceso real lo controla RLS. |

La aplicación **no usa la `service_role` key** en ningún momento — todas las
operaciones sensibles (por ejemplo, el alta de una organización) se resuelven
con funciones `SECURITY DEFINER` en la base de datos, invocadas como el
usuario autenticado.

## Configuración de Supabase

### Opción A: proyecto en la nube

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Copiá `Project URL` y `anon public key` a `.env.local`.
3. Aplicá las migraciones de `supabase/migrations/` con el CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push
   ```

### Opción B: desarrollo local (Docker)

```bash
npx supabase start
```

Esto levanta Postgres, Auth y Storage localmente y aplica las migraciones de
`supabase/migrations/` automáticamente. El comando imprime la URL y las keys
locales para pegar en `.env.local`.

Para reaplicar las migraciones desde cero durante el desarrollo:

```bash
npx supabase db reset
```

## Auth y creación de usuarios

La autenticación es la nativa de Supabase Auth (email + contraseña). No hace
falta insertar usuarios a mano: cualquier persona puede registrarse desde
`/signup`, y un trigger de base de datos (`handle_new_user`) crea
automáticamente su fila en `profiles`.

## Bootstrap de organización

Un usuario recién registrado no pertenece a ninguna organización. Al iniciar
sesión sin organizaciones, la app muestra un onboarding (`/onboarding`) que
pide el nombre del negocio y llama a la función `bootstrap_organization` (RPC,
`SECURITY DEFINER`), la cual en una sola transacción:

1. crea la `organization`;
2. crea el `organization_member` con rol `owner`;
3. crea los estados de trabajo (`job_statuses`) iniciales;
4. crea tipos de trabajo (`job_types`) de ejemplo;
5. crea los horarios laborales (`business_hours`) por defecto (lunes a
   viernes 08:00–17:00).

## Migrations y RLS

Las migraciones versionadas viven en `supabase/migrations/`. Resumen:

**Fase 0-1**

- `..._init_schema.sql`: extensiones, tablas de negocio, índices y triggers
  (`updated_at` automático, alta de perfil, historial de estados de trabajo).
- `..._rls_policies.sql`: activa RLS en todas las tablas de negocio y define
  las funciones helper `is_org_member`, `is_org_operator`, `is_org_admin` y
  `shares_organization_with`, usadas por las policies para evitar
  recursividad.
- `..._bootstrap.sql`: función `bootstrap_organization` y su helper de
  generación de `slug`.

**Fase 2**

- `..._materials_stock_schema.sql`: `material_categories`, `material_units`,
  `materials`, `stock_movements` (append-only, única fuente de verdad del
  stock) y la vista `material_stock_balances` (`security_invoker`) que deriva
  el saldo; `job_materials` con trigger de integridad cross-org.
- `..._suppliers_schema.sql`: `suppliers` y `supplier_material_prices` como
  historial inmutable, más la vista `material_latest_prices`.
- `..._quotes_schema.sql`: `quote_counters` + `quotes` + `quote_items`, la
  función `create_quote` (numeración `COT-NNNNNN` atómica), el trigger que
  recalcula `subtotal`/`total` en el servidor, y la máquina de estados
  (`draft → sent → accepted/rejected`) que bloquea transiciones inválidas y
  la edición de una cotización fuera de borrador.
- `..._phase2_rls.sql`: RLS de las tablas anteriores + bucket privado
  `quotes` en Storage con policies scoped por organización.
- `..._phase2_bootstrap_and_backfill.sql`: unidades de medida semilla, con
  backfill para organizaciones creadas antes de esta migración.
- `..._job_material_consumption.sql`: RPC
  `register_job_material_consumption`, que registra el consumo real de un
  material de forma idempotente (guarda solo el delta contra el valor
  anterior, con row lock) para que reenviar el mismo formulario no descuente
  stock dos veces.

**Fase 2.1**

- `..._job_material_status_view.sql`: vista `job_material_status`, única
  fórmula de "cuánto falta" de un material en un trabajo (ver sección
  siguiente). Corrige un bug de Fase 2 donde el faltante se calculaba como
  `estimated_quantity - stock` e ignoraba el consumo ya registrado en ese
  trabajo (cuanto más se consumía correctamente, más alto parecía el
  faltante).

**Fase 3**

- `..._payments_schema.sql`: `payment_methods`, `payment_accounts`,
  `job_payments` (append-only, con `client_request_id` único por organización
  para idempotencia), trigger de integridad cross-org + "método que requiere
  cuenta exige cuenta", y los RPC `register_job_payment` / `void_job_payment`.
- `..._payments_rls.sql`: RLS de las tres tablas y bucket privado
  `payment-receipts` en Storage.
- `..._one_accepted_quote_per_job.sql`: índice único parcial
  `quotes_one_accepted_per_job` (una sola cotización `accepted` por trabajo).
  Antes de aplicarlo se verificó que no había trabajos con más de una aceptada.
- `..._financial_views.sql`: vistas `job_financial_status` y
  `client_financial_summary` (`security_invoker`).
- `..._payments_bootstrap_and_backfill.sql`: medios de pago y cuenta
  "Efectivo" semilla para organizaciones existentes y futuras.
- `..._register_job_payment_optional_args.sql`: argumentos opcionales con
  default en `register_job_payment` (tipado generado correcto).

Reglas de acceso por rol (mismo patrón en toda la app):

- **viewer**: solo lectura de los datos de su organización.
- **worker**: lectura/escritura de clientes, trabajos, sesiones, materiales,
  stock/consumos, proveedores, precios y cotizaciones.
- **admin/owner**: además, administra configuración (tipos, estados,
  horarios, miembros).

Un usuario nunca puede leer ni escribir datos de una organización a la que no
pertenece — no hay política que lo permita, y por defecto (sin política) el
acceso queda denegado, incluyendo para `anon`. La integridad cross-org
(ej. material de la organización B asociado a un trabajo de la A) se refuerza
con triggers `BEFORE INSERT/UPDATE`, no solo con RLS.

## Materiales, stock y proveedores

- El stock nunca se edita directamente: siempre es la suma con signo de
  `stock_movements` (`in`/`return`/`adjustment_in` suman, `consumption`/
  `adjustment_out` restan).
- Los precios de proveedor se guardan como historial completo, nunca se
  sobrescribe un precio viejo; el "último precio" se deriva por fecha.
- Reserva de stock: **fuera de alcance de esta fase** — el stock disponible
  usado en los cálculos es el stock físico actual, sin reservar cantidades
  para trabajos futuros. Queda documentado como decisión técnica para no
  bloquear la fase actual; una futura columna `reserved_quantity` o una tabla
  de reservas puede agregarse sin romper lo existente.

### Fuentes de verdad y fórmulas de "cuánto falta" (Fase 2.1)

Todas las pantallas (ficha del trabajo, dashboard, solicitud de precios)
leen estos valores de la vista `public.job_material_status`
(`security_invoker`, respeta RLS) — nunca se reimplementa la fórmula en el
frontend. El espejo en TypeScript, solo para tests unitarios y cálculos
puramente de cliente, vive en
[`src/lib/materials/requirement.ts`](src/lib/materials/requirement.ts).

| Campo | Fuente | Definición |
| --- | --- | --- |
| `estimated_quantity` | `job_materials.estimated_quantity` | Cuánto se estimó que este trabajo necesita en total. |
| `consumed_quantity` | `job_materials.actual_quantity` | Cuánto se consumió realmente en este trabajo. Es un cache sincronizado transaccionalmente por `register_job_material_consumption` (única función que lo escribe) — nunca una segunda fuente de verdad independiente. |
| `remaining_quantity` | calculado | `max(estimated_quantity - consumed_quantity, 0)`: cuánto falta ejecutar de la estimación original. |
| `current_stock` | `material_stock_balances` | Stock físico global del material (todos los movimientos, no solo los de este trabajo). |
| `missing_quantity` | calculado | `max(remaining_quantity - current_stock, 0)`: cuánto hay que conseguir para cubrir lo pendiente. |
| `variance_quantity` | calculado | `consumed_quantity - estimated_quantity`: desvío sobre lo estimado (positivo = sobreconsumo; no se trata como error). |

`missing_quantity` **nunca** se calcula como `estimated_quantity - stock`:
eso ignora el material que el trabajo ya consumió y hace que el faltante
parezca crecer cuanto más se ejecuta correctamente la obra (bug original:
200 estimados, 150 de stock, se consumen 130 → el stock físico queda en 20 y
el cálculo viejo mostraba "faltan 180" en lugar de "faltan 50").

**Semántica de `return`**: `register_job_material_consumption` guarda el
consumo como un valor absoluto por trabajo+material. Si el usuario corrige
ese valor hacia abajo (por ejemplo, registró 80 y corrige a 60), la función
genera un movimiento `return` por el delta (20) — el material vuelve al
stock físico y `actual_quantity` (consumo neto) queda en el nuevo valor. No
existe una devolución "suelta": siempre es `consumption - return` neteado
por la misma función, nunca dos fuentes que puedan divergir.

**Política de stock negativo**: el sistema permite registrar consumo por
encima del stock físico disponible; no hay bloqueo ni advertencia a nivel de
base de datos (`stock_movements` solo exige `quantity > 0`, no valida el
balance resultante). El stock físico global puede quedar negativo. Esto es
una decisión deliberada de esta fase (no se cambia sin una revisión aparte);
queda cubierto por un test en `tests/db/stock-and-missing.test.ts`.

## Cotizaciones y PDF

- Numeración `COT-000001`, `COT-000002`, ... asignada atómicamente por la
  función `create_quote` (upsert sobre un contador por organización); nunca
  se calcula como `MAX + 1` desde el cliente.
- `subtotal` y `total` se recalculan siempre en el servidor a partir de
  `quote_items` (trigger), nunca se confía en el monto que mande el
  navegador.
- El PDF (`/api/quotes/[id]/pdf`) usa una estrategia de snapshot: mientras la
  cotización está en `draft` se regenera en cada request; a partir de `sent`
  se congela la primera versión subida a Storage y se sirve siempre esa misma
  — nunca se regenera en silencio un documento que el cliente ya recibió.
  Se guarda en el bucket privado `quotes`
  (`organizations/{org_id}/quotes/{quote_id}/cotizacion.pdf`) y se accede vía
  signed URL de corta duración.
- El PDF nunca incluye `cost_unit_price`, margen, notas internas ni usuario
  interno — solo lo que ve el cliente.
- Aceptar una cotización **no** cambia el estado del trabajo automáticamente:
  la UI pregunta explícitamente si querés actualizarlo y a qué estado.

## Cobros, saldos y tiempo real (Fase 3)

**Cobro** = dinero recibido. No es una factura ni un comprobante fiscal (no hay
integración con ARCA/CAE/IVA).

Fuentes de verdad (vista `job_financial_status`, única implementación):

| Campo | Definición |
| --- | --- |
| `contracted_amount` | `total` de la única cotización `accepted` del trabajo; `null` si no hay. No existe un "monto contratado" editable. |
| `collected_amount` | `SUM(job_payments.amount)` con `voided_at IS NULL`. |
| `outstanding_amount` | `null` sin contrato; si no, `max(contracted - collected, 0)`. Nunca negativo. |
| `overpaid_amount` | `0` sin contrato; si no, `max(collected - contracted, 0)` ("Excedente cobrado"). |
| `payment_status` | derivado, no guardado: `no_contract` / `unpaid` / `partial` / `paid`. |

- **Una cotización aceptada por trabajo**: garantizado por el índice único
  parcial `quotes_one_accepted_per_job`. Aceptar una segunda falla con
  "Ya existe una cotización aceptada para este trabajo." Sin cotización
  aceptada el saldo es *no calculable* (nunca `$0`), y los cobros siguen visibles.
- **Inmutabilidad**: `job_payments` no tiene policies de INSERT/UPDATE/DELETE.
  Se crea solo con `register_job_payment` y se corrige solo con
  `void_job_payment` (anulación con motivo obligatorio; el registro original
  queda visible como ANULADO y no cuenta en el total).
- **Idempotencia**: el formulario genera un `client_request_id` (UUID) al
  abrirse; reenviarlo (doble click, retry, requests concurrentes) devuelve el
  mismo cobro, nunca un segundo. Constraint `unique (organization_id, client_request_id)`.
- **Medio que requiere cuenta**: si `payment_methods.requires_account`, la
  cuenta es obligatoria (validado en trigger de DB, no solo en el frontend).
- **Roles**: owner/admin/worker registran cobros; **solo owner/admin anulan** y
  configuran medios/cuentas; viewer solo lee.
- **Comprobantes**: bucket privado `payment-receipts`, path
  `organizations/{org}/jobs/{job}/payments/{client_request_id}/{archivo}` (se usa
  `client_request_id` en vez del id del cobro porque el archivo se sube *antes*
  de crear el cobro). PDF/JPG/PNG/WEBP, máx. 8 MB, acceso por signed URL de 5 min.
- Cambiar el estado del trabajo al saldar es una **confirmación explícita**
  (nunca automático; los estados son configurables y solo se usa `is_closed`).
- "Cerrado" = `job_statuses.is_closed`; la fecha de cierre se deriva de
  `job_status_history` (última entrada a un estado cerrado), no de `updated_at`.
- Actividad del trabajo: se deriva combinando `job_status_history` y
  `job_payments` (registro/anulación); no hay tabla de eventos aparte.
- Fuera de alcance: reembolsos reales, facturación fiscal, conciliación bancaria.

**Tiempo real**: `estimated_minutes` (trabajo) vs `actual_start_at/actual_end_at`
(sesiones completadas). El tiempo *planificado* nunca se usa como sustituto del
real: una sesión completada sin tiempo real aporta 0 minutos y marca
"Datos reales incompletos". Al completar una sesión se piden hora real de
inicio/fin (con "Usar horario planificado" como prefill explícito) y se puede
corregir después. Helper puro: `src/lib/time/job-time-status.ts`.

**Limitación explícita — no hay rentabilidad real todavía.** No existe una
política de valoración del stock consumido (FIFO/promedio/lotes), y el historial
de precios de proveedor no es el costo real de lo que ya se compró. Por eso la
app **no** calcula "costo real", "ganancia" ni "margen real"; solo muestra el
costo interno *estimado* de la cotización ("Margen estimado antes de otros
costos"), cantidades estimadas vs reales, horas y cobros.

## Fechas y sesiones (Fase 3.1)

- **Date-only**: las columnas `date` (`payment_date`, `target_date`, `issue_date`,
  `valid_until`) son fechas de calendario, no instantes. Se muestran con
  `formatDateOnly("YYYY-MM-DD")`, que formatea el texto sin construir un `Date`
  (evita el corrimiento de un día en UTC-3). `formatDate`/`formatDateTime`/`formatTime`
  son solo para `timestamptz` y siempre con la zona de la organización.
- **Horarios**: `zonedDateTimeToIso` / `zonedParts` (`src/lib/scheduling/timezone.ts`)
  convierten fecha+hora de pared en la zona de la organización a/desde UTC; nunca
  se usa la zona del proceso (Vercel corre en UTC). "Hoy" y "este mes" salen de
  `todayKeyInTZ(timezone)`. `supplier_material_prices.recorded_at` (timestamptz)
  se guarda al mediodía de la zona de la organización.
- **Sesiones idempotentes**: `job_sessions.client_request_id` (único por
  organización cuando no es null) + RPC `create_job_session`. El formulario genera
  un UUID al abrirse; reenvíos/doble click/concurrencia devuelven la misma sesión.
  No hay unique por (trabajo, horario): dos sesiones iguales con requests distintos
  son legítimas. No existe INSERT directo sobre `job_sessions`.
- `npm run test:tz` corre los tests unitarios en UTC y en Buenos Aires.

## Compras, stock valorizado y costo real de materiales (Fase 4)

Una **compra** es la adquisición física de materiales; no es un pago (no hay
cuentas corrientes ni vencimientos de proveedores).

- **Compras** (`purchases` + `purchase_items`): numeración atómica `COM-000001`
  por organización, estados `draft` -> `received` | `cancelled`. Crear/editar
  borradores lo puede hacer cualquier operador; **recibir y cancelar** solo
  owner/admin (recibir fija valor de inventario). Un borrador no toca el stock.
  El estado solo cambia por los RPC `receive_purchase` / `cancel_purchase`
  (un `UPDATE` directo del estado es rechazado por trigger), y una compra
  recibida es de solo lectura (solo se puede adjuntar/reemplazar el documento).
  `create_purchase` es idempotente por `client_request_id`.
- **Recibir** (`receive_purchase`): transaccional e idempotente. Bloquea la fila de
  la compra, genera un movimiento `in` valorizado por ítem (`purchase_id`,
  `purchase_item_id`) y marca la compra como recibida. Reenviar/doble click/
  concurrencia genera los movimientos una sola vez. Los movimientos ligados a una
  compra solo pueden crearse dentro de ese RPC.
- **Valoración por costo promedio ponderado móvil**. Fuentes de verdad:
  cantidad física = `material_stock_balances`; valor de inventario =
  `material_inventory_valuation.inventory_value`; **costo promedio = valor /
  cantidad** (derivado); costo de un consumo = `stock_movements.unit_cost/total_cost`,
  **congelado** al insertarse y nunca recalculado con compras o precios posteriores.
  Todo se aplica en el trigger `apply_stock_valuation` (bajo lock del material), así
  que ninguna ruta de escritura puede saltearlo y dos movimientos concurrentes se
  serializan. Al vaciar el stock el valor queda exactamente en 0 (sin residuo de
  redondeo). Escalas: cantidades `numeric(14,3)`/`(18,3)`, costo unitario
  `numeric(18,6)`, importes `numeric(20,6)`.
- **Devoluciones** (`return`) enlazadas al consumo original
  (`reversal_of_movement_id`): restauran el costo histórico de lo que revierten y
  no pueden exceder lo consumido. Una corrección de consumo hacia abajo se reparte
  entre los consumos del propio trabajo (el más reciente primero).
- **Ajustes**: `adjustment_out` sale al costo promedio vigente; `adjustment_in` y el
  stock inicial **requieren costo unitario**.
- **Stock negativo bloqueado** (`stock_insuficiente`): consumir o ajustar a la baja
  por encima del stock físico se rechaza. (Antes de Fase 4 estaba permitido;
  los saldos negativos históricos se reportan en la migración pero no se corrigen.)
- **Stock anterior a la valoración** (los movimientos históricos NO reciben ningún
  costo, ni el último precio de proveedor): el material queda en "Costo no
  inicializado" y sus consumos se registran sin costo. Un owner/admin ejecuta
  **Inicializar valoración** (ficha del material, `initialize_material_valuation`)
  con un costo unitario explícito; queda auditado en `material_valuation_events`
  y no reescribe los movimientos viejos. Un material con stock 0 se valoriza con
  su primera compra. Mientras haya stock sin costo, ingresar stock valorizado se
  bloquea (`valoracion_no_inicializada`) para no mezclar costos.
- **Precio consultado != costo de compra**: `supplier_material_prices` (lo que un
  proveedor cotizó) es un dato aparte y nunca se usa para costear consumos. La ficha
  del material muestra por separado costo promedio, valor del stock, última compra
  y último precio consultado.
- **Costo real de materiales por trabajo** (`job_cost_status`, `job_material_costs`):
  real = consumos - devoluciones a costo congelado; estimado = suma de
  `cantidad x cost_unit_price` de los ítems de material de la cotización aceptada;
  desvío = real - estimado. Si algún consumo del trabajo no tiene costo
  (`material_cost_complete = false`) la UI muestra "Costo real incompleto" en lugar
  de un total parcial. El desvío se marca como *parcial* mientras haya materiales
  pendientes de consumir. Es solo costo de materiales: **no es rentabilidad**
  (no incluye mano de obra ni otros costos).
- **Crear compra desde el faltante**: `/app/compras/nueva?job=<id>` precarga
  `job_material_status.missing_quantity` (no el estimado ni el pendiente). No reserva
  stock; `source_job_id` es solo contexto de creación, el costo se imputa al trabajo
  cuando el material se consume.
- **Documento del proveedor**: bucket privado `purchase-documents`
  (`organizations/{org}/purchases/{purchase}/...`), acceso por URL firmada
  (`/api/purchases/[id]/document`), policies por organización.
- UI: `/app/compras` (filtros por proveedor/estado/fechas, cards en mobile),
  `/app/compras/nueva`, `/app/compras/[id]`, tarjeta "Costos de materiales" en el
  resumen del trabajo, costo real por material en la tab Materiales, compras en la
  ficha del proveedor, y en el dashboard: compras del mes, materiales sin
  valoración y trabajos finalizados con costo incompleto.
- Migraciones: `20260922000001`..`05` (schema de compras, valoración, recepción,
  RLS/Storage, vistas de costo). Tests: `tests/db/valuation.test.ts`,
  `tests/db/purchases.test.ts`, `tests/rls/purchases-rls.test.ts`,
  `tests/unit/purchase-validation.test.ts`.

Fuera de alcance de esta fase: pagos a proveedores/cuentas corrientes,
vencimientos, IVA/ARCA, costos indirectos, mano de obra, reservas de stock,
órdenes de compra complejas, recepciones parciales, múltiples depósitos, lotes,
FIFO/LIFO, OCR e integración bancaria. Cancelar una compra ya recibida tampoco
está soportado (habría que revertir movimientos valorizados).

## Tests

```
tests/
  unit/     # Puros, sin red (calculateMaterialRequirement). npm run test
  db/       # Contra Postgres/Supabase local real: stock, faltante, idempotencia,
            # cotizaciones (numeración, totales, máquina de estados). npm run test:db
  rls/      # Contra Supabase local real: anon denegado, aislamiento entre
            # organizaciones, Storage. npm run test:rls
  helpers/  # Clientes de Supabase (admin/anon/usuario) y fixtures compartidas.
```

```bash
npx supabase start      # o `npx supabase db reset` si ya estaba corriendo
npm run test            # unitarios (rápidos, no requieren Supabase)
npm run test:db         # DB — requiere Supabase local corriendo
npm run test:rls        # RLS — requiere Supabase local corriendo
npm run test:all        # los tres, en orden
```

Nota: sobre el stack local cargado (Docker compartido con otros proyectos o
justo después de un `db reset`) PostgREST puede cancelar alguna sentencia por el
`statement_timeout` de 8s del rol (`canceling statement due to statement timeout`)
de forma intermitente y en cualquier test. Los helpers reintentan el alta de
usuarios/organizaciones ante ese error transitorio; si un test falla así, volvé a
correr la suite (no es un fallo funcional). Tras un `db reset` conviene además
`docker restart supabase_rest_<proyecto>` para refrescar el schema cache.

Los tests de `db/` y `rls/` nunca mockean Postgres: crean usuarios y
organizaciones reales vía `supabase.auth.admin` + `bootstrap_organization`,
y verifican el comportamiento contra la base real (incluye llamadas RPC
concurrentes para probar la numeración atómica de cotizaciones y la
idempotencia del registro de consumo).

## Ejecución local

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Validación

```bash
npm run typecheck
npm run lint
npm run build
npm run test:all   # requiere Supabase local corriendo (npx supabase start)
```

## Deploy en Vercel

1. Importá el repositorio en Vercel.
2. Configurá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como
   variables de entorno del proyecto (Production/Preview/Development).
3. Deploy. No se requiere configuración adicional de build.

## Alcance

**Fase 0-1**: autenticación, alta de organización, clientes, trabajos,
sesiones/agenda con cálculo de capacidad, dashboard operativo y configuración
básica (negocio, tipos de trabajo, estados, horarios).

**Fase 2**: identidad de marca JM Electricista, materiales (categorías,
unidades, stock por movimientos), proveedores y precios, integración de
materiales en la ficha del trabajo (necesario/stock/faltante, solicitud de
precios por WhatsApp, registro de consumo real), cotizaciones (numeración,
importar materiales del trabajo, mano de obra/servicios, descuento, margen
interno, estados, PDF con Storage privado) y las alertas de materiales
faltantes/cotizaciones en el dashboard.

**Fase 2.1**: corrección del cálculo de "faltante" de materiales para que
considere el consumo ya registrado en el trabajo (no solo `estimated -
stock`), vista `job_material_status` como fuente única de esa fórmula,
suite de tests versionada (`tests/unit`, `tests/db`, `tests/rls`) contra
Supabase local real, y verificación manual en mobile (375px) de proveedores,
ficha de proveedor, ficha de material y el editor de cotizaciones.

**Fase 3**: medios de pago y cuentas configurables, cobros (parciales,
anulables, idempotentes, con comprobante), saldos derivados, tab Cobros en el
trabajo, página `/app/cobros`, resumen financiero en cliente y dashboard,
tiempo real vs estimado y advertencias de cierre no bloqueantes.

**Fase 4**: compras a proveedores, entradas de stock valorizadas (costo
promedio ponderado móvil), stock negativo bloqueado, inicialización auditada de
stock histórico y costo real de materiales por trabajo (ver sección arriba).

Fuera de alcance (a propósito, ver secciones de arriba y el prompt de Fase 2):
cobros/facturación fiscal, caja, cuentas corrientes de proveedores, reserva de
stock, integración con Google Calendar o la API de WhatsApp, IA, rutas,
cuadrillas avanzadas. La arquitectura (multi-organización, `organization_id`
en todo, catálogos configurables) está pensada para incorporarlos después sin
rediseñar.
