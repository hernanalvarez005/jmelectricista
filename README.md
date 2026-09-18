# jmelectricista

Sistema de gestión de trabajos para profesionales y empresas de servicios de campo
(electricidad, plomería, gas, refrigeración, etc.). El eje del producto es el
`Trabajo` y su capacidad de agenda — no un calendario convencional: un trabajo
puede dividirse en múltiples sesiones de agenda, y el sistema muestra si la
carga planificada supera la capacidad laboral disponible.

Modelado desde el inicio como **multi-organización**: nada del dominio (tipos
de trabajo, estados, horarios laborales) está hardcodeado, para poder
reutilizar la misma base con otros oficios en el futuro.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) (PostgreSQL, Auth, RLS)
- Despliegue en [Vercel](https://vercel.com)

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

- `..._init_schema.sql`: extensiones, tablas de negocio, índices y triggers
  (`updated_at` automático, alta de perfil, historial de estados de trabajo).
- `..._rls_policies.sql`: activa RLS en todas las tablas de negocio y define
  las funciones helper `is_org_member`, `is_org_operator`, `is_org_admin` y
  `shares_organization_with`, usadas por las policies para evitar
  recursividad.
- `..._bootstrap.sql`: función `bootstrap_organization` y su helper de
  generación de `slug`.

Reglas de acceso por rol:

- **viewer**: solo lectura de los datos de su organización.
- **worker**: lectura/escritura de clientes, trabajos y sesiones.
- **admin/owner**: además, administra configuración (tipos, estados,
  horarios, miembros).

Un usuario nunca puede leer ni escribir datos de una organización a la que no
pertenece — no hay política que lo permita, y por defecto (sin política) el
acceso queda denegado, incluyendo para `anon`.

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

## Alcance de esta fase (0-1)

Implementado: autenticación, alta de organización, clientes, trabajos,
sesiones/agenda con cálculo de capacidad, dashboard operativo y configuración
básica (negocio, tipos de trabajo, estados, horarios).

Fuera de alcance (a propósito): cotizaciones, materiales/stock, proveedores,
cobros/facturación, integración con WhatsApp/Google Calendar, IA, rutas. La
arquitectura (multi-organización, `organization_id` en todo, catálogos
configurables) está pensada para incorporarlos después sin rediseñar.
