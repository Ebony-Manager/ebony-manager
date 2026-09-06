import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// Data Access Layer for auth. Every server-side auth/role check goes
// through here so the rules live in one place. Not a Client Component
// module — it imports the server Supabase client (next/headers), which
// throws if pulled into the browser bundle.

export type AppRole = "admin" | "vendedor";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  role: AppRole;
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

  return (data as Profile | null) ?? null;
});

/** Profile or bust — redirects to /login if unauthenticated. */
export const requireProfile = cache(async (): Promise<Profile> => {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
});

export async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin";
}

/** Gate a page/action to admins. Non-admins are bounced to the app entry. */
export const requireAdmin = cache(async (): Promise<Profile> => {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/cotizacion");
  return profile;
});
