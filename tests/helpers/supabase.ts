import { createHmac } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Tests de DB/RLS pegan contra una instancia real de Supabase local
 * (`npx supabase start`), nunca contra mocks. Las keys de abajo son las
 * mismas demo keys que imprime `supabase start`/`supabase status` en
 * cualquier proyecto (no son secretas), y sirven de default para no
 * requerir configuración extra en desarrollo local; se pueden overridear
 * con variables de entorno si hiciera falta apuntar a otro puerto/proyecto.
 */
export const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54421";
export const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SLOW_REQUEST_MS = Number(process.env.TEST_SLOW_MS ?? 3000);

/** Reporta a stderr los requests lentos (>TEST_SLOW_MS) para distinguir stalls del entorno de queries realmente lentas. */
const timedFetch: typeof fetch = async (input, init) => {
  const started = Date.now();
  try {
    return await fetch(input, init);
  } finally {
    const elapsed = Date.now() - started;
    if (elapsed > SLOW_REQUEST_MS) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      console.warn(`[slow-request] ${elapsed}ms ${init?.method ?? "GET"} ${url.replace(SUPABASE_URL, "")}`);
    }
  }
};

/**
 * Secret JWT del stack local de Supabase (el mismo default público en cualquier
 * `supabase start`; no es un secreto real). Se usa para acuñar el access token de
 * los usuarios de test en vez de hacer login por contraseña: el login pasa por
 * bcrypt en GoTrue, que es CPU-bound y llegaba a tardar 20s en una VM de Docker
 * saturada. PostgREST y Storage validan la firma del JWT igual que con uno emitido
 * por GoTrue, así que RLS se sigue ejerciendo contra `auth.uid()` reales.
 */
const JWT_SECRET = process.env.TEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function mintAccessToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      aud: "authenticated",
      role: "authenticated",
      sub: userId,
      email,
      aal: "aal1",
      iat: now,
      exp: now + 60 * 60,
    })
  );
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Cliente autenticado como un usuario ya creado (sin pasar por GoTrue). */
export function userClient(userId: string, email: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timedFetch, headers: { Authorization: `Bearer ${mintAccessToken(userId, email)}` } },
  });
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timedFetch },
  });
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timedFetch },
  });
}

let counter = 0;
/** Email único por test run para no chocar con corridas anteriores. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `test-${label}-${Date.now()}-${counter}@example.com`;
}

/**
 * El stack local responde a veces con timeouts transitorios: GoTrue ("Processing
 * this request timed out") o PostgREST (`statement timeout` de 8s del rol) justo
 * después de un `supabase start`/`db reset`, o cuando el Docker compartido está
 * cargado. Se reintenta unas pocas veces solo ese error transitorio (una
 * sentencia cancelada por timeout hace rollback, así que reintentar es seguro);
 * cualquier otro error falla directo.
 */
function isTransient(message: string | undefined): boolean {
  return Boolean(message && (message.includes("timed out") || message.includes("statement timeout")));
}

async function retryTransient<T extends { error: { message: string } | null }>(
  fn: () => PromiseLike<T>,
  attempts = 4
): Promise<T> {
  let result = await fn();
  for (let i = 1; i < attempts && isTransient(result.error?.message); i++) {
    await new Promise((r) => setTimeout(r, 1500 * i));
    result = await fn();
  }
  return result;
}


/** Crea un usuario confirmado + organización propia, devuelve un client logueado como ese usuario. */
export async function createTestUserWithOrg(
  label: string
): Promise<{ client: SupabaseClient<Database>; userId: string; email: string; organizationId: string }> {
  const admin = adminClient();
  const email = uniqueEmail(label);

  const { data: created, error: createError } = await retryTransient(() =>
    admin.auth.admin.createUser({ email, email_confirm: true })
  );
  if (createError || !created.user) {
    throw new Error(`No se pudo crear usuario de test: ${createError?.message}`);
  }

  const client = userClient(created.user.id, email);

  const { data: orgId, error: bootstrapError } = await retryTransient(() =>
    client.rpc("bootstrap_organization", { org_name: `Org de test ${label} ${Date.now()}` })
  );
  if (bootstrapError || !orgId) {
    throw new Error(`No se pudo bootstrapear organización de test: ${bootstrapError?.message}`);
  }

  return { client, userId: created.user.id, email, organizationId: orgId as string };
}

/**
 * Crea un usuario nuevo y lo agrega como miembro de una organización
 * existente con el rol dado (el owner de esa organización es quien hace el
 * alta, vía RLS real de organization_members — no se usa el service role
 * para saltarse la policy).
 */
export async function createOrgMember(
  ownerClient: SupabaseClient<Database>,
  organizationId: string,
  role: "owner" | "admin" | "worker" | "viewer",
  label: string
): Promise<{ client: SupabaseClient<Database>; userId: string; email: string }> {
  const admin = adminClient();
  const email = uniqueEmail(label);

  const { data: created, error: createError } = await retryTransient(() =>
    admin.auth.admin.createUser({ email, email_confirm: true })
  );
  if (createError || !created.user) {
    throw new Error(`No se pudo crear usuario de test: ${createError?.message}`);
  }

  const { error: memberError } = await ownerClient
    .from("organization_members")
    .insert({ organization_id: organizationId, user_id: created.user.id, role, active: true });
  if (memberError) throw new Error(`No se pudo agregar miembro de test: ${memberError.message}`);

  const client = userClient(created.user.id, email);

  return { client, userId: created.user.id, email };
}
