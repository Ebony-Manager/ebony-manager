import "server-only";

import { createHash } from "node:crypto";


import { hasAnyModule, type AppModule } from "@/lib/auth/modules";
import { recordRun } from "@/lib/integrations/record";
import { createClient } from "@/lib/supabase/server";
import type { McpUser } from "./auth";

/**
 * Piezas comunes de las herramientas de CONSULTA del MCP (fuera de
 * Contratistas, que tiene las suyas): respuestas, montos y el guardián de
 * permisos. Cada consulta exige el módulo de la app (como la pantalla
 * equivalente), corre con el token de la persona (la RLS aplica) y queda
 * anotada en Settings → Conexiones.
 */

export type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
export const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }] });
export const fail = (msg: string): Result => ({ content: [{ type: "text", text: msg }], isError: true });
/** Centavos → dólares. */
export const usd = (cents: number | null | undefined) => (cents == null ? null : Math.round(cents) / 100);
/** Para buscar por nombre: sin acentos, minúsculas, espacios simples. */
export const fold = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
export const matches = (q: string | undefined, ...fields: (string | null | undefined)[]) =>
  !q || fields.some((f) => fold(f).includes(fold(q)));

export const READ_ONLY = { readOnlyHint: true } as const;

/** Nombres legibles de los módulos, para el mensaje de "sin permiso". */
const MODULE_NAME: Partial<Record<AppModule, string>> = {
  cotizacion: "Cotización",
  costos: "Costos",
  proyectos: "Proyectos",
  documentos: "Personal",
  planilla: "Planilla",
  asistencia: "Asistencia",
  almacen: "Almacén",
  almacen_compras: "Compras del almacén",
  almacen_costos: "Costos del almacén",
  directorio: "Directorio",
  inspecciones: "Inspecciones",
  taller: "Taller",
};

/**
 * Registra una consulta que exige al menos uno de `modules`. `fn` recibe
 * los argumentos ya validados por el esquema.
 */
export function makeReadRegistrar(user: McpUser) {
  const note = async (tool: string, okRun: boolean, detail?: string) =>
    recordRun(await createClient(), null, "mcp", okRun, `${user.email ?? user.id} · ${tool}${detail ? `: ${detail}` : ""}`);

  return function guard<A>(tool: string, modules: AppModule[], fn: (args: A) => Promise<Result>) {
    return async (args: A): Promise<Result> => {
      if (!hasAnyModule(user.profile, modules)) {
        await note(tool, false, "sin permiso");
        const names = modules.map((m) => MODULE_NAME[m] ?? m).join(" o ");
        return fail(`Tu usuario no tiene el permiso de ${names} en Ebony Manager.`);
      }
      try {
        const res = await fn(args);
        await note(tool, !res.isError);
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await note(tool, false, msg);
        return fail(`Error al consultar: ${msg}`);
      }
    };
  };
}

/** Código de confirmación de una escritura: sale de los datos exactos de la
 *  vista previa, así si algo cambia entre la vista previa y el "sí", no
 *  coincide y no se guarda nada. */
export function confirmationCode(userId: string, kind: string, plan: unknown): string {
  return createHash("sha256").update(`${userId}|${kind}|${JSON.stringify(plan)}`).digest("hex").slice(0, 10);
}

export const CODE_MISMATCH =
  "El código no coincide con estos datos (cambió algo desde la vista previa). Vuelve a pedir la vista previa y confírmala.";
export const NEXT_STEP = "Muestra esto a la persona. Si lo aprueba, llama de nuevo con los mismos datos, confirmar: true y este codigo_confirmacion.";
