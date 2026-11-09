import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { currentAccessToken } from "./request-token";

/**
 * Supabase client for Server Components / Route Handlers / Server Actions.
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (set in
 * .env.local locally, and in Vercel for the deployed app).
 *
 * The session cookies it reads are kept fresh by proxy.ts on every
 * request; the `setAll` catch below is the documented no-op for the case
 * where this client is used from a Server Component (which can't write
 * cookies) rather than a Route Handler / Server Action.
 */
export async function createClient() {
  // Dentro del MCP (ver request-token.ts): con el token de la IA, sin cookies.
  const token = currentAccessToken();
  if (token) {
    return createTokenClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }) as unknown as ReturnType<typeof createServerClient<Database>>;
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no response to write to.
            // Safe to ignore: proxy.ts refreshes the session cookies on
            // every request.
          }
        },
      },
    }
  );
}
