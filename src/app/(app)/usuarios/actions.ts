"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireAdmin } from "@/lib/auth/dal";
import * as users from "@/services/app-users";
import type { AppUserInput } from "@/types/usuarios";

// Usuarios es solo-admin: cada action verifica `requireAdmin()` al entrar
// (además de la RLS admin-only de `allowed_emails`). Devuelven el error como
// dato en vez de lanzarlo: en producción Next oculta el mensaje de un error
// lanzado desde un action, y acá el mensaje es lo que el admin necesita leer
// ("ese correo ya está", "límite de correos de Supabase"...).

const PATH = "/usuarios";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type InviteResult = { ok: true; emailSent: boolean; emailError?: string } | { ok: false; error: string };

function message(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Error";
}

/** Adónde vuelve el invitado al abrir el enlace: la misma app desde la que se invitó. */
async function confirmUrl(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return `${origin}/auth/confirm`;
}

export async function inviteUserAction(email: string, input: AppUserInput): Promise<InviteResult> {
  const me = await requireAdmin();
  let normalized: string;
  try {
    normalized = await users.createAppUser(email, input, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(PATH);

  // Si el correo falla, el usuario igual queda agregado (puede entrar con
  // Google, o se reenvía la invitación después).
  try {
    await users.sendInvitation(normalized, await confirmUrl());
  } catch (err) {
    return { ok: true, emailSent: false, emailError: message(err) };
  }
  revalidatePath(PATH);
  return { ok: true, emailSent: true };
}

export async function resendInvitationAction(email: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await users.sendInvitation(email, await confirmUrl());
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateUserAction(email: string, input: AppUserInput): Promise<ActionResult> {
  const me = await requireAdmin();
  // Nadie se quita a sí mismo el rol de admin: así siempre queda al menos uno.
  if (email.toLowerCase() === me.email.toLowerCase() && input.role !== "admin") {
    return { ok: false, error: "No puedes quitarte a ti mismo el rol de administrador" };
  }
  try {
    await users.updateAppUser(email, input);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteUserAction(email: string): Promise<ActionResult> {
  const me = await requireAdmin();
  if (email.toLowerCase() === me.email.toLowerCase()) {
    return { ok: false, error: "No puedes quitarte el acceso a ti mismo" };
  }
  try {
    await users.deleteAppUser(email);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(PATH);
  return { ok: true };
}
