import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  parseCompany,
  parsePayment,
  parseTerms,
  SETTING_KEYS,
  type CompanyInfo,
  type DocumentSettings,
  type PaymentInfo,
  type QuoteTerms,
} from "@/lib/settings/documents";

/**
 * Ajustes de los documentos para el cliente (`app_settings`): todos los
 * usuarios los leen (salen en cada cotización); solo el admin los cambia
 * (la RLS lo exige). Lo que no esté guardado toma los valores de siempre.
 */
export async function getDocumentSettings(): Promise<DocumentSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value").in("key", Object.values(SETTING_KEYS));
  if (error) throw new Error(error.message);
  const byKey = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
  return {
    terms: parseTerms(byKey.get(SETTING_KEYS.terms)),
    company: parseCompany(byKey.get(SETTING_KEYS.company)),
    payment: parsePayment(byKey.get(SETTING_KEYS.payment)),
  };
}

type Saveable = { terms: QuoteTerms; company: CompanyInfo; payment: PaymentInfo };

export async function saveDocumentSetting<K extends keyof Saveable>(kind: K, value: Saveable[K]): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: SETTING_KEYS[kind], value: value as unknown as Json, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null });
  if (error) throw new Error(error.message);
}
