import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Los tests de DB/RLS pegan contra Supabase local real y son más
    // lentos que los unitarios; los corremos secuenciales para no pisar
    // fixtures entre sí (misma organización/usuarios de prueba). El timeout
    // default de 5s no alcanza justo después de un `supabase start`/`db
    // reset` en frío (Auth/Postgres todavía calentando).
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
