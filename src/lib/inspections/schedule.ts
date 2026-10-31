// Programación de detalles de inspección (sin Supabase ni React): la semana,
// el estado de cada programación, el cumplimiento por persona y el texto del
// plan para mandar por WhatsApp.

import type { InspectionSchedule, ScheduleItem } from "@/types/inspections";

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** El lunes de la semana de esa fecha. */
export function weekStart(iso: string): string {
  const d = toDate(iso);
  const dow = d.getUTCDay(); // 0 = domingo
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return toIso(d);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Lunes a sábado de la semana que empieza en `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
}

export type ScheduleState = "programado" | "hecho" | "vencido";

/** Hecho (resuelto), vencido (pasó el día y sigue pendiente) o programado. */
export function scheduleState(s: Pick<InspectionSchedule, "outcome" | "date">, today: string): ScheduleState {
  if (s.outcome === "hecho") return "hecho";
  return s.date < today ? "vencido" : "programado";
}

export interface PersonCompliance {
  personId: string;
  personName: string;
  /** Programaciones cuyo día ya pasó (o es hoy y ya se hizo). */
  total: number;
  onTime: number;
  late: number;
  /** Vencidas o reprogramadas. */
  missed: number;
  /** a tiempo ÷ total (0–1); null sin programaciones. */
  rate: number | null;
}

/**
 * Cumplimiento por persona desde `since` hasta hoy: a tiempo = resuelto el
 * mismo día programado (o antes); tarde = resuelto después; no hecho = se
 * reprogramó o se venció. Lo de hoy que todavía no se hace no cuenta.
 */
export function compliance(schedules: readonly InspectionSchedule[], since: string, today: string): PersonCompliance[] {
  const by = new Map<string, PersonCompliance>();
  for (const s of schedules) {
    if (s.date < since || s.date > today || s.outcome === "cancelado") continue;
    if (s.outcome === "programado" && s.date === today) continue;
    const c = by.get(s.personId) ?? { personId: s.personId, personName: s.personName, total: 0, onTime: 0, late: 0, missed: 0, rate: null };
    c.total += 1;
    if (s.outcome === "hecho") {
      if (s.closedAt && s.closedAt.slice(0, 10) > s.date) c.late += 1;
      else c.onTime += 1;
    } else c.missed += 1;
    by.set(s.personId, c);
  }
  return [...by.values()]
    .map((c) => ({ ...c, rate: c.total ? c.onTime / c.total : null }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.total - a.total);
}

/** Las programaciones de una persona en unos días, por día y orden. */
export function personPlan(schedules: readonly InspectionSchedule[], personId: string, days: readonly string[]): InspectionSchedule[] {
  const set = new Set(days);
  return schedules
    .filter((s) => s.personId === personId && set.has(s.date) && (s.outcome === "programado" || s.outcome === "hecho"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
}

/**
 * El plan como texto para WhatsApp:
 *   *Plan de Pedro · 3–8 nov*
 *   *Lunes 3*
 *   1. Ponticelli – PH Buenavista 4B · Cocina: retocar puerta
 */
export function planText(
  title: string,
  plan: readonly InspectionSchedule[],
  items: ReadonlyMap<string, ScheduleItem>,
  dayLabel: (iso: string) => string,
): string {
  const lines = [`*${title}*`];
  let day = "";
  for (const s of plan) {
    if (s.date !== day) {
      day = s.date;
      lines.push("", `*${dayLabel(day)}*`);
    }
    const it = items.get(s.itemId);
    if (!it) continue;
    const what = [it.area?.trim(), it.comment.trim()].filter(Boolean).join(": ");
    lines.push(`${s.order}. ${it.projectName}${it.location ? ` (${it.location})` : ""} · ${what}${s.note ? ` — ${s.note}` : ""}`);
  }
  return lines.join("\n");
}
