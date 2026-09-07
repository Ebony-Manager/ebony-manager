import type { Lang } from "@/lib/i18n";
import { MONTHS_ES, MONTHS_EN } from "@/lib/planilla/payroll-period";

/** Nombre corto del mes (1-12), 3 letras, en el idioma dado. */
export function monthShort(lang: Lang, month1to12: number): string {
  return (lang === "en" ? MONTHS_EN : MONTHS_ES)[month1to12 - 1]?.slice(0, 3) ?? "";
}

/** Fecha `YYYY-MM-DD` -> texto local ("5 sep 2026" / "Sep 5, 2026"). */
export function formatDate(lang: Lang, iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "en" ? "en-US" : "es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "sep 2026" / "Sep 2026" a partir de un ISO date. */
export function monthYear(lang: Lang, iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${monthShort(lang, month)} ${year}`;
}

/** Etiqueta de quincena: "Septiembre 2026 · 1ra Quincena". */
export function periodLabel(lang: Lang, p: { year: number; month: number; half: 1 | 2 }, quincena1: string, quincena2: string): string {
  const m = (lang === "en" ? MONTHS_EN : MONTHS_ES)[p.month - 1] ?? "";
  return `${m} ${p.year} · ${p.half === 1 ? quincena1 : quincena2}`;
}

/** Formato contable: negativos entre paréntesis. */
export function fmtSigned(cents: number, formatCents: (c: number) => string): string {
  return cents < 0 ? `(${formatCents(Math.abs(cents))})` : formatCents(cents);
}
