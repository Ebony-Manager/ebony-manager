import "server-only";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeModules, type AppRole } from "@/lib/auth/modules";
import type { Database } from "@/types/database";
import type { AppUser, AppUserInput } from "@/types/usuarios";

/**
 * Capa de datos de Settings → Usuarios. La lista de usuarios es
 * `allowed_emails` (quién puede entrar y a qué); `profiles` solo aporta
 * nombre, foto y último acceso de quien ya tiene cuenta. Los permisos se
 * guardan en `allowed_emails` y un trigger los copia al perfil (ver
 * supabase/migrations/20261020120000_usuarios_permisos.sql). RLS: solo admin.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Correo inválido");
  return email;
}

function cleanInput(input: AppUserInput) {
  if (input.role !== "admin" && input.role !== "vendedor") throw new Error("Rol inválido");
  return {
    role: input.role,
    // El admin entra a todo: no se le guardan módulos sueltos.
    modules: input.role === "admin" ? [] : normalizeModules(input.modules),
    note: input.note?.trim() || null,
  };
}

export async function getAppUsers(): Promise<AppUser[]> {
  const supabase = await createClient();
  const [{ data: allowed, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
    supabase.from("allowed_emails").select("*").order("created_at"),
    supabase.from("profiles").select("id, email, full_name, avatar_url, last_sign_in_at"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const byEmail = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p]));
  return (allowed ?? []).map((a) => {
    const p = byEmail.get(a.email.toLowerCase());
    return {
      email: a.email,
      role: a.role as AppRole,
      modules: normalizeModules(a.modules ?? []),
      note: a.note,
      createdAt: a.created_at,
      invitedAt: a.invited_at,
      profileId: p?.id ?? null,
      fullName: p?.full_name ?? null,
      avatarUrl: p?.avatar_url ?? null,
      lastSignInAt: p?.last_sign_in_at ?? null,
    };
  });
}

export async function createAppUser(rawEmail: string, input: AppUserInput, invitedBy: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const supabase = await createClient();

  const { error } = await supabase
    .from("allowed_emails")
    .insert({ email, ...cleanInput(input), invited_by: invitedBy });
  // 23505 = el correo (sin importar mayúsculas) ya está en la lista.
  if (error?.code === "23505") throw new Error("Ese correo ya está en la lista de usuarios");
  if (error) throw error;
  return email;
}

export async function updateAppUser(email: string, input: AppUserInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").update(cleanInput(input)).eq("email", email);
  if (error) throw error;
}

/** Quita el acceso: el trigger borra el perfil, y sin perfil la app no deja entrar. */
export async function deleteAppUser(email: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
  if (error) throw error;
}

/**
 * Manda el correo de invitación con Supabase Auth y la clave pública — sin
 * service_role. Es un enlace de acceso de un solo uso: si la persona aún no
 * tiene cuenta, Supabase la crea en ese momento (el trigger de alta la deja
 * pasar porque el correo ya está en allowed_emails) y el correo llega con la
 * plantilla "Confirm signup"; si ya tenía, con la plantilla "Magic Link".
 *
 * Cliente aparte, sin cookies y en flujo implícito: el enlace se abre en el
 * navegador del invitado, que no tiene el "code verifier" que pediría PKCE.
 * La sesión llega en el `#hash` y la toma /auth/confirm.
 */
export async function sendInvitation(email: string, redirectTo: string): Promise<void> {
  const anon = createPlainClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });
  if (error) throw error;

  const supabase = await createClient();
  await supabase.from("allowed_emails").update({ invited_at: new Date().toISOString() }).eq("email", email);
}
