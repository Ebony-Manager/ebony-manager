// Programación de detalles de inspección (sin Supabase ni React). Lo principal
// es ponerle día a los detalles: un área completa de una obra a un día, en un
// orden; quién lo atiende se asigna encima. Aquí: la semana, las áreas de una
// obra, los bloques (obra · área) de cada día, el estado, el cumplimiento por
// persona y el texto del plan para WhatsApp.

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

/**
 * Clave del área para agrupar: sin mayúsculas, acentos ni espacios de más
 * ("Cocina " = "cocina" = "Cocína"). "" = sin área.
 */
export function areaKey(area: string | null | undefined): string {
  return (area ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Orden natural de los detalles: la visita, luego cuándo se anotó. */
const byInspection = (a: ScheduleItem, b: ScheduleItem) => a.visitedOn.localeCompare(b.visitedOn) || a.createdAt.localeCompare(b.createdAt);

export interface AreaGroup {
  /** `${projectId}|${areaKey}` */
  key: string;
  projectId: string;
  projectName: string;
  /** El nombre como se escribió la primera vez; null = sin área. */
  area: string | null;
  items: ScheduleItem[];
}

/** Los detalles de una o varias obras por área (en el orden en que se anotaron). */
export function groupByArea(items: readonly ScheduleItem[]): AreaGroup[] {
  const groups = new Map<string, AreaGroup>();
  for (const it of [...items].sort((a, b) => a.projectName.localeCompare(b.projectName) || byInspection(a, b))) {
    const key = `${it.projectId}|${areaKey(it.area)}`;
    const g = groups.get(key) ?? { key, projectId: it.projectId, projectName: it.projectName, area: it.area?.trim() || null, items: [] };
    g.items.push(it);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export interface DayBlock {
  /** `${projectId}|${areaKey}` */
  key: string;
  projectId: string;
  area: string | null;
  /** En su orden del día. */
  schedules: InspectionSchedule[];
}

/**
 * Lo de un día como bloques obra · área, en el orden del día (el bloque va
 * donde está su primer detalle). Las programaciones deben ser de un solo día.
 */
export function dayBlocks(schedules: readonly InspectionSchedule[], items: ReadonlyMap<string, ScheduleItem>): DayBlock[] {
  const blocks = new Map<string, DayBlock>();
  for (const s of [...schedules].sort((a, b) => a.order - b.order)) {
    const it = items.get(s.itemId);
    if (!it) continue;
    const key = `${it.projectId}|${areaKey(it.area)}`;
    const b = blocks.get(key) ?? { key, projectId: it.projectId, area: it.area?.trim() || null, schedules: [] };
    b.schedules.push(s);
    blocks.set(key, b);
  }
  return [...blocks.values()];
}

export type ScheduleState = "programado" | "hecho" | "vencido";

/** Hecho (resuelto), vencido (pasó el día y sigue pendiente) o programado. */
export function scheduleState(s: Pick<InspectionSchedule, "outcome" | "date">, today: string): ScheduleState {
  if (s.outcome === "hecho") return "hecho";
  return s.date < today ? "vencido" : "programado";
}

/** Estado de un bloque: hecho si todo está hecho; vencido si algo se venció; si no, programado. */
export function blockState(schedules: readonly Pick<InspectionSchedule, "outcome" | "date">[], today: string): ScheduleState {
  const states = schedules.map((s) => scheduleState(s, today));
  if (states.length && states.every((x) => x === "hecho")) return "hecho";
  return states.includes("vencido") ? "vencido" : "programado";
}

/** Quién atiende un bloque: el nombre si es uno solo, "varios" si son varios, null si nadie. */
export function blockPeople(schedules: readonly Pick<InspectionSchedule, "personId" | "personName">[]): { names: string[]; unassigned: number } {
  const names = [...new Set(schedules.filter((s) => s.personId).map((s) => s.personName ?? ""))];
  return { names, unassigned: schedules.filter((s) => !s.personId).length };
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
 * reprogramó o se venció. Lo de hoy que todavía no se hace no cuenta, ni lo
 * que no tenía a nadie asignado.
 */
export function compliance(schedules: readonly InspectionSchedule[], since: string, today: string): PersonCompliance[] {
  const by = new Map<string, PersonCompliance>();
  for (const s of schedules) {
    if (!s.personId) continue;
    if (s.date < since || s.date > today || s.outcome === "cancelado") continue;
    if (s.outcome === "programado" && s.date === today) continue;
    const c = by.get(s.personId) ?? { personId: s.personId, personName: s.personName ?? "", total: 0, onTime: 0, late: 0, missed: 0, rate: null };
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

/** De quién o de qué es un plan: una obra, una persona o todo. */
export type PlanTarget = { projectId: string } | { personId: string } | null;

/** Las programaciones (abiertas o hechas) de una obra o persona en unos días, por día y orden. */
export function planSchedules(
  schedules: readonly InspectionSchedule[],
  items: ReadonlyMap<string, ScheduleItem>,
  target: PlanTarget,
  days: readonly string[],
): InspectionSchedule[] {
  const set = new Set(days);
  return schedules
    .filter((s) => set.has(s.date) && (s.outcome === "programado" || s.outcome === "hecho"))
    .filter((s) => {
      if (!target) return true;
      if ("personId" in target) return s.personId === target.personId;
      return items.get(s.itemId)?.projectId === target.projectId;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
}

/** Un plan día por día y bloque por bloque (obra · área), con los detalles numerados dentro de cada día. */
export function planSections(plan: readonly InspectionSchedule[], items: ReadonlyMap<string, ScheduleItem>) {
  const days: { date: string; blocks: (DayBlock & { numbers: number[] })[] }[] = [];
  for (const date of [...new Set(plan.map((s) => s.date))]) {
    let n = 0;
    const blocks = dayBlocks(
      plan.filter((s) => s.date === date),
      items,
    ).map((b) => ({ ...b, numbers: b.schedules.map(() => ++n) }));
    days.push({ date, blocks });
  }
  return days;
}

/**
 * El plan como texto para WhatsApp:
 *   *Plan · Nómada – Golden Palace · 3–8 nov*
 *
 *   *Lunes 3*
 *   ▸ Cocina — Pedro
 *   1. retocar puerta
 *   ▸ Baño principal
 *   2. masillar zócalo
 * Con varias obras, cada bloque lleva la obra delante del área.
 */
export function planText(
  title: string,
  plan: readonly InspectionSchedule[],
  items: ReadonlyMap<string, ScheduleItem>,
  dayLabel: (iso: string) => string,
  labels: { noArea: string },
): string {
  const lines = [`*${title}*`];
  const multiProject = new Set(plan.map((s) => items.get(s.itemId)?.projectId).filter(Boolean)).size > 1;
  for (const day of planSections(plan, items)) {
    lines.push("", `*${dayLabel(day.date)}*`);
    for (const b of day.blocks) {
      const it = items.get(b.schedules[0].itemId);
      const where = [multiProject ? it?.projectName : null, b.area ?? labels.noArea].filter(Boolean).join(" · ");
      const { names } = blockPeople(b.schedules);
      lines.push(`▸ ${where}${names.length ? ` — ${names.join(", ")}` : ""}`);
      const notes = [...new Set(b.schedules.map((s) => s.note).filter(Boolean))];
      for (const note of notes) lines.push(`  _${note}_`);
      b.schedules.forEach((s, k) => {
        const item = items.get(s.itemId);
        if (item) lines.push(`${b.numbers[k]}. ${item.comment.trim()}`);
      });
    }
  }
  return lines.join("\n");
}
