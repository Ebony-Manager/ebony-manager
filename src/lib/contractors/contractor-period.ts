/**
 * Ventanas de período para el estado de cuenta de Contratistas. PURO
 * (sin `server-only`, sin cliente de Supabase) — corre en vitest igual
 * que `contractor-ledger.ts`.
 *
 * REGLA CLAVE DEL SALDO: estas funciones solo deciden QUÉ filas se
 * muestran. El saldo corrido de cada fila se calcula SIEMPRE sobre la
 * historia completa (ver `withRunningBalance`) y nunca se reinicia por
 * período — igual que la columna de saldo del Excel del dueño.
 */
import type { Lang } from "@/lib/i18n";
import { monthLabel } from "@/lib/planilla/payroll-period";

export type LedgerPeriodView =
  | "month"
  | "quarter"
  | "semester"
  | "year"
  | "last15"
  | "all";

/** Orden fijo para el selector. "Mes" es el valor por defecto al abrir. */
export const LEDGER_PERIOD_VIEWS: readonly LedgerPeriodView[] = [
  "month",
  "quarter",
  "semester",
  "year",
  "last15",
  "all",
] as const;

/** Cuántos movimientos muestra la vista comprimida "Últimos N". */
export const LAST_N_MOVEMENTS = 15;

/** Las vistas de calendario necesitan un ancla (año/mes) y navegación ‹ ›.
 *  "last15" y "all" no. */
export function isCalendarView(view: LedgerPeriodView): boolean {
  return view === "month" || view === "quarter" || view === "semester" || view === "year";
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function iso(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Primer y último mes (1-12) de la ventana que contiene `month1to12`. */
function windowMonths(view: LedgerPeriodView, month1to12: number): { start: number; end: number } {
  switch (view) {
    case "month":
      return { start: month1to12, end: month1to12 };
    case "quarter": {
      const start = Math.floor((month1to12 - 1) / 3) * 3 + 1;
      return { start, end: start + 2 };
    }
    case "semester": {
      const start = month1to12 <= 6 ? 1 : 7;
      return { start, end: start + 5 };
    }
    default:
      // year (y cualquier no-calendario, defensivo)
      return { start: 1, end: 12 };
  }
}

/** Límites [startISO, endISO] inclusivos (YYYY-MM-DD) de la ventana de
 *  calendario. Se comparan lexicográficamente contra `entryDate`. */
export function calendarWindow(
  view: LedgerPeriodView,
  year: number,
  month1to12: number
): { startISO: string; endISO: string } {
  const { start, end } = windowMonths(view, month1to12);
  return {
    startISO: iso(year, start, 1),
    endISO: iso(year, end, lastDayOfMonth(year, end)),
  };
}

/** Mueve el ancla una ventana completa hacia atrás (-1) o adelante (1).
 *  Normaliza primero al inicio de la ventana, así ‹ › es estable sin
 *  importar en qué mes de la ventana cayera el ancla. */
export function shiftAnchor(
  view: LedgerPeriodView,
  year: number,
  month1to12: number,
  dir: -1 | 1
): { year: number; month: number } {
  const step = view === "month" ? 1 : view === "quarter" ? 3 : view === "semester" ? 6 : 12;
  const { start } = windowMonths(view, month1to12);
  const monthsFromZero = year * 12 + (start - 1) + dir * step;
  return { year: Math.floor(monthsFromZero / 12), month: (monthsFromZero % 12) + 1 };
}

/** Etiqueta corta de la ventana: "Septiembre 2026", "T3 2026", "S2 2026",
 *  "2026". Trimestre/semestre usan códigos (T/S en ES, Q/H en EN). */
export function windowLabel(
  lang: Lang,
  view: LedgerPeriodView,
  year: number,
  month1to12: number
): string {
  switch (view) {
    case "month":
      return `${monthLabel(lang, month1to12)} ${year}`;
    case "quarter":
      return `${lang === "en" ? "Q" : "T"}${Math.floor((month1to12 - 1) / 3) + 1} ${year}`;
    case "semester":
      return `${lang === "en" ? "H" : "S"}${month1to12 <= 6 ? 1 : 2} ${year}`;
    case "year":
      return String(year);
    default:
      return "";
  }
}
