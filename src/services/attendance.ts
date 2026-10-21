import "server-only";

import { createClient } from "@/lib/supabase/server";
import { selectAllRows } from "@/lib/supabase/select-all";
import { punchKey } from "@/lib/attendance/jotform-punch";
import type { DayResolution, RawPunch } from "@/lib/attendance/types";

/**
 * Ponchadas guardadas (`attendance_punches`): las del reloj entran al subir
 * su archivo; las del Jotform llegan solas por el webhook (o al subir su
 * export). Al subir se ignora lo que ya estaba (misma `dedupe_key`).
 */

export interface AttendanceStatus {
  /** Última ponchada guardada de cada fuente (fecha y minutos), o null. */
  lastReloj: { date: string; minutes: number } | null;
  lastJotform: { date: string; minutes: number } | null;
}

export async function getPunches(from: string, to: string): Promise<RawPunch[]> {
  const supabase = await createClient();
  const rows = await selectAllRows((a, b) =>
    supabase
      .from("attendance_punches")
      .select("source, raw_name, code, punch_date, punch_minutes, kind, location")
      .gte("punch_date", from)
      .lte("punch_date", to)
      .order("id")
      .range(a, b)
  );
  return rows.map((r) => ({
    name: r.raw_name,
    ...(r.code ? { code: r.code } : {}),
    date: r.punch_date,
    minutes: r.punch_minutes,
    kind: r.kind === "in" || r.kind === "out" ? r.kind : "unknown",
    source: r.source === "jotform" ? "jotform" : "reloj",
    ...(r.location ? { location: r.location } : {}),
  }));
}

export async function getAttendanceStatus(): Promise<AttendanceStatus> {
  const supabase = await createClient();
  const last = async (source: "reloj" | "jotform") => {
    const { data, error } = await supabase
      .from("attendance_punches")
      .select("punch_date, punch_minutes")
      .eq("source", source)
      .order("punch_date", { ascending: false })
      .order("punch_minutes", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { date: data.punch_date, minutes: data.punch_minutes } : null;
  };
  const [lastReloj, lastJotform] = await Promise.all([last("reloj"), last("jotform")]);
  return { lastReloj, lastJotform };
}

/** Guarda las marcaciones de un archivo. Devuelve cuántas eran nuevas y cuántas ya estaban. */
export async function importPunches(punches: RawPunch[], userId: string): Promise<{ inserted: number; existing: number }> {
  const supabase = await createClient();
  // Sin repetidas dentro del mismo archivo (Postgres no deja la misma clave dos veces en un insert).
  const byKey = new Map<string, RawPunch>();
  for (const p of punches) {
    // Lo que manda el navegador se revisa: fecha real, minuto del día, fuente conocida.
    const ok =
      /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
      Number.isInteger(p.minutes) &&
      p.minutes >= 0 &&
      p.minutes < 1440 &&
      (p.source === "reloj" || p.source === "jotform") &&
      ["in", "out", "unknown"].includes(p.kind) &&
      typeof p.name === "string" &&
      p.name.trim() !== "";
    if (ok) byKey.set(punchKey(p), p);
  }
  const rows = [...byKey].map(([key, p]) => ({
    source: p.source,
    dedupe_key: key,
    raw_name: p.name,
    code: p.code ?? null,
    punch_date: p.date,
    punch_minutes: p.minutes,
    kind: p.kind,
    location: p.location ?? null,
    created_by: userId,
  }));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await supabase
      .from("attendance_punches")
      .upsert(rows.slice(i, i + 500), { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    inserted += data?.length ?? 0;
  }
  return { inserted, existing: rows.length - inserted };
}

/** Vínculos nombre → empleado (null = no es empleado). */
export async function getNameLinks(): Promise<Record<string, string | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("attendance_name_links").select("name_key, employee_id");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.name_key, r.employee_id]));
}

export async function deleteNameLink(nameKey: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_name_links").delete().eq("name_key", nameKey);
  if (error) throw new Error(error.message);
}

export async function setNameLink(nameKey: string, employeeId: string | null, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_name_links")
    .upsert({ name_key: nameKey, employee_id: employeeId, created_by: userId }, { onConflict: "name_key" });
  if (error) throw new Error(error.message);
}

export type StoredResolution = DayResolution & { employeeId: string; date: string };

/** Días revisados a mano entre dos fechas. */
export async function getResolutions(from: string, to: string): Promise<StoredResolution[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_day_resolutions")
    .select("employee_id, day, arrival_minutes, departure_minutes, note")
    .gte("day", from)
    .lte("day", to);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    employeeId: r.employee_id,
    date: r.day,
    arrival: r.arrival_minutes,
    departure: r.departure_minutes,
    note: r.note,
  }));
}

export async function setResolution(r: StoredResolution, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_day_resolutions").upsert(
    {
      employee_id: r.employeeId,
      day: r.date,
      arrival_minutes: r.arrival,
      departure_minutes: r.departure,
      note: r.note?.trim() || null,
      created_by: userId,
    },
    { onConflict: "employee_id,day" }
  );
  if (error) throw new Error(error.message);
}

export async function deleteResolution(employeeId: string, date: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_day_resolutions").delete().eq("employee_id", employeeId).eq("day", date);
  if (error) throw new Error(error.message);
}
