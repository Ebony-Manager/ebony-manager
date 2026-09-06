import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

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
