import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchPanamaHolidays } from "@/lib/holidays/feriados-io";
import type { Holiday, HolidayStatus } from "@/types/holidays";
import { errText, recordRun } from "@/lib/integrations/record";

type Row = {
  date: string;
  name: string;
  source: string;
  status: string;
  mandatory_rest: boolean | null;
  irrenunciable: boolean | null;
  original_date: string | null;
  missing_from_source: boolean;
};

const mapRow = (r: Row): Holiday => ({
  date: r.date,
  name: r.name,
  source: r.source === "feriados_io" ? "feriados_io" : "manual",
  status: r.status === "pendiente" || r.status === "descartado" ? r.status : "confirmado",
  mandatoryRest: r.mandatory_rest,
  irrenunciable: r.irrenunciable,
  originalDate: r.original_date,
  missingFromSource: r.missing_from_source,
});

/** Todos los feriados de un año (confirmados, por confirmar y descartados). */
export async function getHolidaysOfYear(year: number): Promise<Holiday[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("date, name, source, status, mandatory_rest, irrenunciable, original_date, missing_from_source")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

/** Los feriados CONFIRMADOS entre dos fechas (los únicos que cuentan en asistencia): fecha → nombre. */
export async function getConfirmedHolidays(from: string, to: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").select("date, name").eq("status", "confirmado").gte("date", from).lte("date", to);
  // Sin la tabla (migración pendiente) o con un error, la asistencia sigue como antes: sin feriados.
  if (error) {
    console.error("feriados", error.message);
    return {};
  }
  return Object.fromEntries((data ?? []).map((r) => [r.date, r.name]));
}

export async function setHolidayStatus(date: string, status: HolidayStatus, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("holidays")
    .update({ status, decided_by: userId, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("date", date);
  if (error) throw new Error(error.message);
}

/** Un día a mano (ej. uno que da la empresa): entra confirmado. */
export async function addManualHoliday(date: string, name: string, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("holidays")
    .insert({ date, name, source: "manual", status: "confirmado", decided_by: userId, decided_at: new Date().toISOString() });
  if (error) throw new Error(error.code === "23505" ? "Ese día ya está en la lista." : error.message);
}

export async function deleteManualHoliday(date: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("date", date).eq("source", "manual");
  if (error) throw new Error(error.message);
}

/** Sincroniza un año con feriados.io (como admin, con su sesión). Devuelve cuántos quedan por confirmar. */
export async function syncHolidaysAsAdmin(year: number): Promise<number> {
  const supabase = await createClient();
  try {
    const items = await fetchPanamaHolidays(year);
    const { data, error } = await supabase.rpc("sync_holidays", { p_token: null, p_year: year, p_items: items as unknown as never });
    if (error) throw new Error(error.message);
    await recordRun(supabase, null, "feriados", true, `${year}: ${items.length} días, ${data ?? 0} por confirmar (a mano)`);
    return data ?? 0;
  } catch (err) {
    await recordRun(supabase, null, "feriados", false, errText(err));
    throw err;
  }
}
