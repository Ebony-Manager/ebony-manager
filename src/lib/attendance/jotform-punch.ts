/**
 * Formulario "Punch In/Out" de JotForm (la gente en proyectos poncha con el
 * celular) → una marcación. Puro y probado; lo usa el webhook
 * (`/api/jotform/webhook`) para guardar cada ponchada al momento.
 *
 * Los campos se buscan por su nombre en JotForm sin depender del número de
 * pregunta (`q3_fecha`, `q7_hora`…): Fecha, Hora, "Entrada o Salida?",
 * "Temp Nombre", ID (el código de la persona, ej. "Eds02") y "Detected
 * Location".
 */
import { parseJotformDate, type AnswersByName } from "@/lib/personal/jotform-intake";
import type { RawPunch } from "./types";

export const PUNCH_FORM_ID = "230425597385868";

const str = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Fecha: el objeto de JotForm, "2026-10-21", "10/21/2026" o "10 21 2026 …". */
export function parsePunchDate(value: unknown): string | null {
  const iso = parseJotformDate(value);
  if (iso) return iso;
  const m = /^(\d{1,2})[/\s-](\d{1,2})[/\s-](\d{4})/.exec(str(value));
  return m ? parseJotformDate({ year: m[3], month: m[1], day: m[2] }) : null;
}

/** Hora en minutos: `{hourSelect, minuteSelect, ampm}`, `{timeInput}`, "08:29", "08 29" o "5:08 PM". */
export function parsePunchTime(value: unknown): number | null {
  const o = obj(value);
  let text = str(o.timeInput) || (str(o.hourSelect) ? `${str(o.hourSelect)}:${str(o.minuteSelect) || "0"}` : "") || str(value);
  const ampm = (str(o.ampm) || (/\b(am|pm)\b/i.exec(text)?.[1] ?? "")).toUpperCase();
  text = text.replace(/\s*(am|pm)\s*$/i, "");
  const m = /^(\d{1,2})[:\s](\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const CODE = /^[a-z]{2,4}\d{1,3}$/i;

/** Las respuestas del formulario → la marcación; null si falta nombre, fecha u hora (ej. el botón TEST). */
export function normalizePunch(answers: AnswersByName): (RawPunch & { location?: string }) | null {
  const keys = Object.keys(answers);
  const find = (re: RegExp) => keys.find((k) => re.test(k));
  const val = (re: RegExp) => {
    const k = find(re);
    return k ? answers[k] : undefined;
  };

  const date = parsePunchDate(val(/fecha/i));
  const minutes = parsePunchTime(val(/hora/i));
  const rawName = str(val(/nombre/i));
  const name = rawName && rawName.toLowerCase() !== "undefined" ? rawName.replace(/\s+/g, " ") : "";
  // El código: el campo "ID" (su nombre en JotForm puede ser "id", "id4"…),
  // o cualquier texto suelto con forma de código.
  const idKey = find(/^id\d*$/i);
  const code = (idKey ? str(answers[idKey]) : "") || keys.map((k) => str(answers[k])).find((v) => CODE.test(v)) || "";
  const kindText = str(val(/entrada|salida/i)).toUpperCase();
  const location = str(val(/location|ubicaci/i));

  if (!date || minutes === null || (!name && !code)) return null;
  return {
    name: name || code,
    ...(code ? { code } : {}),
    date,
    minutes,
    kind: kindText === "ENTRADA" ? "in" : kindText === "SALIDA" ? "out" : "unknown",
    source: "jotform",
    ...(/^https?:\/\//.test(location) ? { location } : {}),
  };
}

/**
 * Clave para no duplicar: la misma marcación subida dos veces, o que entró
 * por el webhook y después por el export, es la misma fila.
 */
export function punchKey(p: Pick<RawPunch, "source" | "name" | "code" | "date" | "minutes">): string {
  const who = (p.code || p.name).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${p.source}|${who}|${p.date}|${p.minutes}`;
}
