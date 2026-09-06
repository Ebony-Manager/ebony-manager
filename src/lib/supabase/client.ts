import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components. Reads NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (set in .env.local locally, and in Vercel
 * for the deployed app). Cookie storage is shared with the server client
 * in src/lib/supabase/server.ts, so a session started here (Google OAuth
 * on /login) is visible to Server Components, Route Handlers and proxy.ts.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
