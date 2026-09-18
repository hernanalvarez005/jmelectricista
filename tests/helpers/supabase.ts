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

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let counter = 0;
/** Email único por test run para no chocar con corridas anteriores. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `test-${label}-${Date.now()}-${counter}@example.com`;
}

const TEST_PASSWORD = "TestPassword123!";

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
    admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
  );
  if (createError || !created.user) {
    throw new Error(`No se pudo crear usuario de test: ${createError?.message}`);
  }

  const client = anonClient();
  const { error: signInError } = await retryTransient(() =>
    client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  );
  if (signInError) throw new Error(`No se pudo loguear usuario de test: ${signInError.message}`);

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
    admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
  );
  if (createError || !created.user) {
    throw new Error(`No se pudo crear usuario de test: ${createError?.message}`);
  }

  const { error: memberError } = await ownerClient
    .from("organization_members")
    .insert({ organization_id: organizationId, user_id: created.user.id, role, active: true });
  if (memberError) throw new Error(`No se pudo agregar miembro de test: ${memberError.message}`);

  const client = anonClient();
  const { error: signInError } = await retryTransient(() =>
    client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  );
  if (signInError) throw new Error(`No se pudo loguear usuario de test: ${signInError.message}`);

  return { client, userId: created.user.id, email };
}
