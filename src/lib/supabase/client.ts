import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Reads NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY — unset until real project credentials are
 * added (see FOUNDATION.md). Nothing calls this yet; Cotización still reads
 * Google Sheets from _legacy/.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
