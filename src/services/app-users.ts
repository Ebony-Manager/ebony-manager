import "server-only";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isOptInModule, normalizeModules, type AppRole } from "@/lib/auth/modules";
import type { Database } from "@/types/database";
import type { AccessCandidate, AppUser, AppUserInput, LinkedEmployee } from "@/types/usuarios";

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
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  if (!firstName || !lastName) throw new Error("Pon el nombre y el apellido");
  return {
    first_name: firstName,
    last_name: lastName,
    role: input.role,
    ...(input.employeeId !== undefined ? { employee_id: input.employeeId } : {}),
    // El admin entra a todo: no se le guardan módulos sueltos, salvo los "a elección" (Accesos rápidos).
    modules: input.role === "admin" ? normalizeModules(input.modules).filter(isOptInModule) : normalizeModules(input.modules),
    note: input.note?.trim() || null,
  };
}

export async function getAppUsers(): Promise<AppUser[]> {
  const supabase = await createClient();
  const [{ data: allowed, error: e1 }, { data: profiles, error: e2 }, { data: staff, error: e3 }] = await Promise.all([
    supabase.from("allowed_emails").select("*").order("created_at"),
    supabase.from("profiles").select("id, email, full_name, avatar_url, last_sign_in_at"),
    supabase.from("payroll_employees").select("id, name, position, status"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  const employeeById = new Map<string, LinkedEmployee>((staff ?? []).map((e) => [e.id, { id: e.id, name: e.name, position: e.position, active: e.status === "ACTIVE" }]));

  const byEmail = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p]));
  return (allowed ?? []).map((a) => {
    const p = byEmail.get(a.email.toLowerCase());
    const listName = [a.first_name, a.last_name].filter(Boolean).join(" ");
    return {
      email: a.email,
      firstName: a.first_name,
      lastName: a.last_name,
      role: a.role as AppRole,
      modules: normalizeModules(a.modules ?? []),
      note: a.note,
      createdAt: a.created_at,
      invitedAt: a.invited_at,
      profileId: p?.id ?? null,
      fullName: listName || p?.full_name || null,
      avatarUrl: p?.avatar_url ?? null,
      lastSignInAt: p?.last_sign_in_at ?? null,
      employee: (a.employee_id && employeeById.get(a.employee_id)) || null,
    };
  });
}

/**
 * Gente de Personal a la que aún no se le ha dado acceso (activos primero). Solo nombre, cargo y
 * correo: nada de sueldo ni planilla. `keepId` deja en la lista a la persona ya enlazada (al editar).
 */
export async function getAccessCandidates(keepId?: string | null): Promise<AccessCandidate[]> {
  const supabase = await createClient();
  const [{ data: staff, error: e1 }, { data: linked, error: e2 }] = await Promise.all([
    supabase.from("payroll_employees").select("id, name, position, email, status"),
    supabase.from("allowed_emails").select("employee_id").not("employee_id", "is", null),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const taken = new Set((linked ?? []).map((l) => l.employee_id as string));
  return (staff ?? [])
    .filter((e) => !taken.has(e.id) || e.id === keepId)
    .map((e) => ({ id: e.id, name: e.name, position: e.position, email: e.email?.trim() || null, active: e.status === "ACTIVE" }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es"));
}

export async function createAppUser(rawEmail: string, input: AppUserInput, invitedBy: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const supabase = await createClient();

  const { error } = await supabase
    .from("allowed_emails")
    .insert({ email, ...cleanInput(input), invited_by: invitedBy });
  // 23505 = el correo (sin importar mayúsculas) ya está en la lista.
  if (error?.code === "23505" && /employee/i.test(error.message)) throw new Error("Esa persona de Personal ya tiene acceso");
  if (error?.code === "23505") throw new Error("Ese correo ya está en la lista de usuarios");
  if (error) throw error;
  return email;
}

export async function updateAppUser(email: string, input: AppUserInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").update(cleanInput(input)).eq("email", email);
  if (error?.code === "23505") throw new Error("Esa persona de Personal ya tiene acceso");
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
 * service_role. Lleva el nombre de la persona en `data` (queda en su
 * user_metadata al crearse la cuenta), para que la plantilla del correo la
 * salude por su nombre (`{{ .Data.first_name }}`, ver supabase/templates). Es un enlace de acceso de un solo uso: si la persona aún no
 * tiene cuenta, Supabase la crea en ese momento (el trigger de alta la deja
 * pasar porque el correo ya está en allowed_emails) y el correo llega con la
 * plantilla "Confirm signup"; si ya tenía, con la plantilla "Magic Link".
 *
 * Cliente aparte, sin cookies y en flujo implícito: el enlace se abre en el
 * navegador del invitado, que no tiene el "code verifier" que pediría PKCE.
 * La sesión llega en el `#hash` y la toma /auth/confirm.
 */
export async function sendInvitation(email: string, redirectTo: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("allowed_emails")
    .select("first_name, last_name")
    .eq("email", email)
    .maybeSingle();
  const firstName = row?.first_name ?? "";
  const lastName = row?.last_name ?? "";

  const anon = createPlainClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
      data: { first_name: firstName, last_name: lastName, full_name: [firstName, lastName].filter(Boolean).join(" ") },
    },
  });
  if (error) throw error;

  await supabase.from("allowed_emails").update({ invited_at: new Date().toISOString() }).eq("email", email);
}
