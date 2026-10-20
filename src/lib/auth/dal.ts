import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { hasAnyModule, hasModules, homePathFor, normalizeModules, type AppModule, type AppRole } from "./modules";

// Data Access Layer for auth. Every server-side auth/role check goes
// through here so the rules live in one place. Not a Client Component
// module — it imports the server Supabase client (next/headers), which
// throws if pulled into the browser bundle.

export type { AppModule, AppRole } from "./modules";

export type Profile = Omit<Database["public"]["Tables"]["profiles"]["Row"], "role" | "modules"> & {
  role: AppRole;
  modules: AppModule[];
};

/**
 * The authenticated Supabase user, or null. Uses getUser() (not
 * getSession()) so the token is verified against the Auth server on every
 * call. `cache` dedupes it within a single request.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

/** Redirects to /login when there is no session. Returns the user otherwise. */
export const requireUser = cache(async (): Promise<User> => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * The current user's profile row (id, email, name, avatar, role). Returns
 * null if there's no session or the row isn't there yet. RLS guarantees a
 * user can only read their own row here.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  return { ...data, role: data.role as AppRole, modules: normalizeModules(data.modules ?? []) };
});

/**
 * Profile or bust — redirects to /login if unauthenticated. A session
 * without a profile means the email was removed from the allow-list
 * (Settings → Usuarios borra el perfil): that goes to the
 * "not authorized" page, not back to /login, which would bounce it here.
 */
export const requireProfile = cache(async (): Promise<Profile> => {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/auth/auth-code-error");
  return profile;
});

export async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin";
}

/** Gate a page/action to admins. Non-admins are bounced to their home module. */
export const requireAdmin = cache(async (): Promise<Profile> => {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect(homePathFor(profile));
  return profile;
});

/**
 * Gate a page/action to users who have ALL the given modules (admins always
 * pass). Others are bounced to their home module. Postgres RLS
 * (`private.has_module`) repeats the same rule as the last line.
 */
export async function requireModule(...modules: AppModule[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!hasModules(profile, modules)) redirect(homePathFor(profile));
  return profile;
}

/** Como requireModule, pero alcanza con UNO de los módulos (ej. Equipo). */
export async function requireAnyModule(...modules: AppModule[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!hasAnyModule(profile, modules)) redirect(homePathFor(profile));
  return profile;
}
