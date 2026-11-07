/**
 * feriados.io (https://feriados.io/docs): los feriados de Panamá de un año.
 * `GET https://api.feriados.io/v1/PA/holidays/:year` con
 * `Authorization: Bearer FERIADOS_API_KEY` (plan gratis: 1.000 consultas al
 * mes; el cron diario usa ~30–60).
 *
 * Cada feriado trae `date`, `name`, `type`, `irrenunciable` y, solo cuando
 * aplica, `original_date` (se trasladó) y `mandatory_rest: false` (no es
 * descanso obligatorio para el sector privado, ej. 2 y 4 de noviembre).
 */

export interface SourceHoliday {
  date: string;
  name: string;
  mandatory_rest: boolean | null;
  irrenunciable: boolean | null;
  original_date: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Lee la respuesta con cuidado: lo que no sea un día válido del año se ignora. */
export function parseFeriadosResponse(body: unknown, year: number): SourceHoliday[] {
  const b = body as { success?: boolean; data?: unknown; error?: { message?: string } } | null;
  if (!b || b.success !== true || !Array.isArray(b.data)) {
    throw new Error(b?.error?.message ?? "Respuesta inesperada de feriados.io");
  }
  const out: SourceHoliday[] = [];
  for (const raw of b.data) {
    const h = raw as Record<string, unknown>;
    const date = typeof h.date === "string" ? h.date : "";
    const name = typeof h.name === "string" ? h.name.trim() : "";
    if (!ISO.test(date) || !date.startsWith(`${year}-`) || !name) continue;
    out.push({
      date,
      name,
      mandatory_rest: typeof h.mandatory_rest === "boolean" ? h.mandatory_rest : null,
      irrenunciable: typeof h.irrenunciable === "boolean" ? h.irrenunciable : null,
      original_date: typeof h.original_date === "string" && ISO.test(h.original_date) ? h.original_date : null,
    });
  }
  return out;
}

export async function fetchPanamaHolidays(year: number): Promise<SourceHoliday[]> {
  const key = process.env.FERIADOS_API_KEY?.trim();
  if (!key) throw new Error("Falta FERIADOS_API_KEY en Vercel.");
  const res = await fetch(`https://api.feriados.io/v1/PA/holidays/${year}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(`feriados.io ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  return parseFeriadosResponse(body, year);
}

/** Qué años sincronizar hoy: el actual y, desde octubre, también el siguiente. */
export function yearsToSync(today: string): number[] {
  const [y, m] = today.split("-").map(Number);
  return m >= 10 ? [y, y + 1] : [y];
}
