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
- El "faltante" de un trabajo (`necesario - disponible`) nunca es negativo.
- Reserva de stock: **fuera de alcance de esta fase** — el stock disponible
  usado en los cálculos es el stock físico actual, sin reservar cantidades
  para trabajos futuros. Queda documentado como decisión técnica para no
  bloquear la fase actual; una futura columna `reserved_quantity` o una tabla
  de reservas puede agregarse sin romper lo existente.

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

Fuera de alcance (a propósito, ver secciones de arriba y el prompt de Fase 2):
cobros/facturación fiscal, caja, cuentas corrientes de proveedores, reserva de
stock, integración con Google Calendar o la API de WhatsApp, IA, rutas,
cuadrillas avanzadas. La arquitectura (multi-organización, `organization_id`
en todo, catálogos configurables) está pensada para incorporarlos después sin
rediseñar.
