import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname, "./src") };

export default defineConfig({
  resolve: { alias },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    projects: [
      {
        // Puros, sin red: pueden correr en paralelo.
        resolve: { alias },
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
        },
      },
      {
        // Pegan contra Supabase local real (Postgres + PostgREST + GoTrue). Son
        // seriales (un solo worker, un archivo a la vez) para no competir entre
        // sí por la base ni por el hash de contraseñas de Auth.
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/db/**/*.test.ts", "tests/rls/**/*.test.ts"],
          globalSetup: ["tests/setup/integration-global-setup.ts"],
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 60_000,
          hookTimeout: 90_000,
          // El stack local (Docker compartido) a veces cancela una sentencia por el
          // statement_timeout de 8s del rol o Auth responde "timed out" bajo carga del
          // host. Solo ese error transitorio se reintenta; cualquier otro (aserciones,
          // errores de negocio) falla al primer intento.
          retry: { count: 2, delay: 1500, condition: /statement timeout|timed out/i },
        },
      },
    ],
  },
});
