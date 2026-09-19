import { execFileSync } from "node:child_process";
import os from "node:os";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function waitFor(label: string, url: string, headers: Record<string, string> = {}, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "sin respuesta";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Supabase local no está listo (${label}: ${lastError}). Corré \`npx supabase start\` (o \`npx supabase db reset\`) antes de los tests de DB/RLS.`
  );
}

function dockerFacts(): { cpus: number; memGiB: number; stacks: number } | null {
  try {
    const info = execFileSync("docker", ["info", "--format", "{{.NCPU}} {{.MemTotal}}"], { encoding: "utf8", timeout: 10_000 }).trim();
    const [cpus, mem] = info.split(" ").map(Number);
    const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8", timeout: 10_000 });
    const stacks = names.split("\n").filter((n) => n.startsWith("supabase_db_")).length;
    return { cpus, memGiB: mem / 1024 ** 3, stacks };
  } catch {
    return null;
  }
}

/**
 * Verifica que Auth y PostgREST respondan antes de correr los tests de
 * integración (evita fallos por arranque en frío tras `db reset`) y deja en el
 * log la carga del host, para poder correlacionar un timeout ambiental con un
 * host saturado en vez de atribuirlo a una query.
 */
export default async function setup() {
  await waitFor("auth", `${SUPABASE_URL}/auth/v1/health`, { apikey: ANON_KEY });
  await waitFor("rest", `${SUPABASE_URL}/rest/v1/`, { apikey: ANON_KEY });
  const [one, five] = os.loadavg();
  const docker = dockerFacts();
  if (docker) {
    console.info(`[integration] docker VM ${docker.cpus} CPUs / ${docker.memGiB.toFixed(1)} GiB, ${docker.stacks} stack(s) de Supabase corriendo`);
    if (docker.cpus < 4 || docker.memGiB < 3.5 || docker.stacks > 1) {
      console.warn(
        "[integration] AVISO: la VM de Docker es chica o comparte más de un stack de Supabase. Bajo presión de memoria/CPU " +
          "PostgREST puede cancelar sentencias por statement_timeout (8s) de forma intermitente. Los tests reintentan solo ese " +
          "error transitorio; para evitarlo, subí CPUs/RAM de Docker o frená los otros stacks."
      );
    }
  }
  console.info(`[integration] host load ${one.toFixed(2)} (1m) / ${five.toFixed(2)} (5m), ${os.cpus().length} CPUs`);
}
