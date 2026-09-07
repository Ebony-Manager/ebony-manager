import path from "node:path";
import { defineConfig } from "vitest/config";

// La capa de cálculos de la Planilla (src/lib/planilla/) es pura: no
// importa `server-only` ni el cliente de Supabase, así que corre en el
// entorno `node` de vitest sin mocks ni DB. Solo hace falta el alias `@`.
// Archivo .mts para que Vite lo cargue como ESM sin tocar el
// package.json de Next (Node >= 22.5 -> import.meta.dirname disponible).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
