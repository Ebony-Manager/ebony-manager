"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/auth/dal";

// Shape the app UI (Navbar, Login) consumes. Derived from the Supabase
// user + profile — kept small on purpose so components don't reach into
// Supabase types directly.
export interface EbonyUser {
  name: string;
  email: string;
  picture?: string;
}

interface AuthContextValue {
  user: EbonyUser | null;
  role: AppRole | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toEbonyUser(user: User | null, seed?: EbonyUser | null): EbonyUser | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    name: seed?.name || meta.full_name || meta.name || user.email || "Usuario",
    email: seed?.email || user.email || "",
    picture: seed?.picture || meta.avatar_url || meta.picture || undefined,
  };
}

/**
 * Seeded from the server: the root layout passes the current user + role
 * (or nulls). After that, a Supabase `onAuthStateChange` subscription keeps
 * it honest — sign-out in another tab, token refreshes, etc. The sign-in
 * path itself is a full-page round trip through /auth/callback, so it does
 * not depend on this listener.
 */
export function AuthProvider({
  children,
  initialUser = null,
  initialRole = null,
}: {
  children: ReactNode;
  initialUser?: EbonyUser | null;
  initialRole?: AppRole | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<EbonyUser | null>(initialUser);
  const [role, setRole] = useState<AppRole | null>(initialRole);
  const [loading, setLoading] = useState(false);

  // Re-sync when the server sends fresh props (e.g. after router.refresh()).
  const seedRef = useRef(initialUser);
  /* eslint-disable react-hooks/set-state-in-effect -- syncing to new server props, not deriving during render. */
  useEffect(() => {
    seedRef.current = initialUser;
    setUser(initialUser);
    setRole(initialRole);
  }, [initialUser, initialRole]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        router.replace("/login");
        return;
      }
      if (session?.user) {
        setUser(toEbonyUser(session.user, seedRef.current));
        // Role is authoritative from the server — refresh so the (app)
        // layout re-reads the profile and re-seeds it through props.
        if (event === "SIGNED_IN") router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/cotizacion`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setLoading(false);
      console.error("Google sign-in error", error);
      alert("No se pudo iniciar el acceso con Google. Intenta de nuevo.");
    }
    // On success the browser navigates away to Google — nothing else here.
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    router.replace("/login");
    router.refresh();
  }, [supabase, router]);

  const value = useMemo(
    () => ({ user, role, loading, signInWithGoogle, signOut }),
    [user, role, loading, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
