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
import { isDifferentAccount } from "@/lib/auth/session-events";
import { hasModule, type AppModule, type AppRole } from "@/lib/auth/modules";

// Shape the app UI (UserMenu, Login) consumes. Derived from the Supabase
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
  modules: AppModule[];
  /** Si el usuario puede abrir un módulo (el admin, todos). Solo para mostrar/ocultar: el gate real es del servidor. */
  can: (module: AppModule) => boolean;
  loading: boolean;
  /** `next`: a dónde volver después (ruta interna, ej. la pantalla de autorización de una herramienta de IA). */
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_MODULES: AppModule[] = [];

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
  initialModules = EMPTY_MODULES,
}: {
  children: ReactNode;
  initialUser?: EbonyUser | null;
  initialRole?: AppRole | null;
  initialModules?: AppModule[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<EbonyUser | null>(initialUser);
  const [role, setRole] = useState<AppRole | null>(initialRole);
  const [modules, setModules] = useState<AppModule[]>(initialModules);
  const [loading, setLoading] = useState(false);

  // Re-sync when the server sends fresh props (e.g. after router.refresh()).
  const seedRef = useRef(initialUser);
  /* eslint-disable react-hooks/set-state-in-effect -- syncing to new server props, not deriving during render. */
  useEffect(() => {
    seedRef.current = initialUser;
    setUser(initialUser);
    setRole(initialRole);
    setModules(initialModules);
  }, [initialUser, initialRole, initialModules]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        setModules(EMPTY_MODULES);
        router.replace("/login");
        return;
      }
      if (session?.user) {
        // Supabase lanza SIGNED_IN cada vez que una pestaña se carga o vuelve a
        // estar visible, y lo reenvía a todas las pestañas: con la misma cuenta
        // no hay nada que actualizar (recargar aquí hacía parpadear y recargar
        // completas todas las pestañas abiertas). Solo si entró otra cuenta,
        // se pide el perfil al servidor (rol/módulos mandan desde allá).
        const changed = isDifferentAccount(seedRef.current?.email, session.user.email);
        if (!changed) return;
        setUser(toEbonyUser(session.user, null));
        if (event === "SIGNED_IN") router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const signInWithGoogle = useCallback(async (next?: string) => {
    setLoading(true);
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
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
    setModules(EMPTY_MODULES);
    router.replace("/login");
    router.refresh();
  }, [supabase, router]);

  const can = useCallback((module: AppModule) => hasModule({ role, modules }, module), [role, modules]);

  const value = useMemo(
    () => ({ user, role, modules, can, loading, signInWithGoogle, signOut }),
    [user, role, modules, can, loading, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
