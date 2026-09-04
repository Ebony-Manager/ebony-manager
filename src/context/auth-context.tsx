"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Minimal shape of the Google Identity Services (GIS) global this file
// needs — the real type comes from Google's own script, loaded at runtime
// via next/script in the root layout, so there's no npm package to type
// against.
interface GoogleTokenClient {
  requestAccessToken: () => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => GoogleTokenClient;
          revoke: (token: string) => void;
        };
      };
    };
  }
}

export interface EbonyUser {
  name: string;
  email: string;
  picture?: string;
}

interface AuthContextValue {
  user: EbonyUser | null;
  token: string | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Scope needed today: read/write Sheets (Cotización, still on _legacy).
// Once other modules move to Supabase, this app will likely want real
// Supabase Auth instead of a Sheets-scoped token — not decided yet, see
// FOUNDATION.md.
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const USER_KEY = "ebony_user";
const TOKEN_KEY = "ebony_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<EbonyUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenClient, setTokenClient] = useState<GoogleTokenClient | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- must run post-hydration, not during render, because it reads browser-only sessionStorage (same pattern as Atlas's readStoredColumns). */
  useEffect(() => {
    const savedUser = window.sessionStorage.getItem(USER_KEY);
    const savedToken = window.sessionStorage.getItem(TOKEN_KEY);
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
    setLoading(false);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Initialize the GIS token client once window.google is available. The
  // script (accounts.google.com/gsi/client) loads via next/script with
  // strategy="afterInteractive", which can resolve after this effect's
  // first run — the old Vite version only checked once on mount and
  // relied on the <script async defer> tag happening to win the race.
  // Polling briefly here is a deliberate reliability fix during the port,
  // not a behavior change: sign-in still does exactly the same thing once
  // the client is ready, it just no longer depends on script-load timing.
  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;
    let attempts = 0;

    function tryInit() {
      if (cancelled) return;
      if (typeof window.google === "undefined") {
        attempts += 1;
        if (attempts < 50) setTimeout(tryInit, 100); // ~5s ceiling
        return;
      }
      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID as string,
        scope: SCOPES,
        callback: (response) => {
          if (response.error || !response.access_token) {
            console.error("OAuth error", response);
            return;
          }
          const accessToken = response.access_token;
          setToken(accessToken);
          window.sessionStorage.setItem(TOKEN_KEY, accessToken);

          fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then((r) => r.json())
            .then((info) => {
              const u: EbonyUser = { name: info.name, email: info.email, picture: info.picture };
              setUser(u);
              window.sessionStorage.setItem(USER_KEY, JSON.stringify(u));
            });
        },
      });
      setTokenClient(tc);
    }

    tryInit();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(() => {
    if (!tokenClient) {
      alert("Google Identity Services no está listo. Verifica NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
      return;
    }
    tokenClient.requestAccessToken();
  }, [tokenClient]);

  const signOut = useCallback(() => {
    if (token) window.google?.accounts.oauth2.revoke(token);
    setUser(null);
    setToken(null);
    window.sessionStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
