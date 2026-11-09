import "server-only";

import { createClient as createAnonClient } from "@supabase/supabase-js";

import type { Profile } from "@/lib/auth/dal";
import { normalizeModules, type AppRole } from "@/lib/auth/modules";
import type { Database } from "@/types/database";

/**
 * Quién llama al MCP: el token (Bearer) lo emite Supabase Auth (OAuth 2.1
 * Server) cuando la persona autoriza a la herramienta de IA con su cuenta de
 * la app. Se verifica la firma (llaves asimétricas del proyecto) y se carga
 * su perfil con el mismo token, así un usuario quitado de Usuarios (sin
 * perfil) ya no entra.
 */
export interface McpUser {
  id: string;
  email: string | null;
  /** La herramienta de IA que pidió el token (claim client_id), si vino por OAuth. */
  clientId: string | null;
  profile: Profile;
}

const anon = () =>
  createAnonClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

export async function verifyMcpToken(token: string): Promise<McpUser | null> {
  const { data, error } = await anon().auth.getClaims(token);
  const claims = data?.claims as (Record<string, unknown> & { sub?: string; email?: string }) | undefined;
  if (error || !claims?.sub) return null;
  const db = createAnonClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: row } = await db.from("profiles").select("*").eq("id", claims.sub).maybeSingle();
  if (!row) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    clientId: typeof claims.client_id === "string" ? claims.client_id : null,
    profile: { ...row, role: row.role as AppRole, modules: normalizeModules(row.modules ?? []) },
  };
}

/** Dirección pública de la app (para los metadatos de OAuth). */
export function appOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  return `${proto}://${host}`;
}

export const supabaseAuthIssuer = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1`;
