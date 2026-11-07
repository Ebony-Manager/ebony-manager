import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Anota el último resultado de una conexión externa (Settings → Conexiones).
 * Nunca falla hacia afuera: anotar es secundario a lo que se estaba haciendo.
 *
 * - Cron y webhook: cliente anónimo + su token.
 * - La app: cliente con la sesión del usuario (token null).
 */
export async function recordRun(
  client: SupabaseClient<Database>,
  token: string | null,
  key: string,
  ok: boolean,
  detail?: string | null
): Promise<void> {
  try {
    const { error } = await client.rpc("record_integration_run", { p_token: token, p_key: key, p_ok: ok, p_detail: detail ?? null });
    if (error) console.error("record_integration_run", key, error.message);
  } catch (err) {
    console.error("record_integration_run", key, err instanceof Error ? err.message : err);
  }
}

export const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
