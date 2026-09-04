import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components / Route Handlers / Server Actions.
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — unset
 * until real project credentials are added (see FOUNDATION.md). Nothing
 * calls this yet; Cotización still reads Google Sheets from _legacy/.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // Called from a Server Component with no request/response to
            // write to — safe to ignore as long as middleware refreshes
            // the session (not set up yet: no auth runs through Supabase
            // in this step).
          }
        },
      },
    }
  );
}
