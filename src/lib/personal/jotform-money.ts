/**
 * Formulario "Solicitud Dinero" de JotForm (dentro de un workflow de
 * aprobación) → solicitud de adelanto o préstamo en la bandeja de Planilla.
 * Puro y probado; lo usa el webhook (`/api/jotform/webhook`).
 */

import { titleCase, type AnswersByName } from "./jotform-intake";

export const MONEY_FORM_ID = "240054334404848";

/** Nombre de cada campo en ese formulario (el `name` de la pregunta en JotForm). */
export const MONEY_FORM_FIELDS = {
  name: "nombre",
  email: "correoElectronico",
  type: "tipoDe",
  amount: "monto",
  deduct: "montoA",
} as const;

/** Recargo del formulario sobre un préstamo (el "Monto a Descontar" = monto + 20%). */
export const LOAN_SURCHARGE_PCT = 20;

export type MoneyRequestType = "adelanto" | "prestamo";

export interface MoneyRequestFields {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  type: MoneyRequestType | null;
  amountCents: number | null;
  deductCents: number | null;
}

/** "100.00", "$1,200.5", 75 → centavos; lo que no es un número → null. */
export function parseMoneyCents(value: unknown): number | null {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.replace(/[$,\s]/g, "") : "";
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function parseRequestType(value: unknown): MoneyRequestType | null {
  const s = typeof value === "string" ? value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() : "";
  if (s.includes("adelanto")) return "adelanto";
  if (s.includes("prestamo")) return "prestamo";
  return null;
}

/**
 * Parámetros sueltos del paso "Webhook" del workflow de JotForm (que no manda
 * la respuesta entera, solo lo que se le configure): `nombre`, `apellido`,
 * `correo`, `tipo`, `monto`, `montoDescontar` → el mismo mapa que la API.
 * Sin ninguno de esos, null.
 */
export function answersFromWorkflowParams(params: Record<string, string>): AnswersByName | null {
  const get = (k: string) => params[k]?.trim() ?? "";
  if (!get("nombre") && !get("correo") && !get("monto")) return null;
  const f = MONEY_FORM_FIELDS;
  return {
    [f.name]: { first: get("nombre"), last: get("apellido") },
    [f.email]: get("correo"),
    [f.type]: get("tipo"),
    [f.amount]: get("monto"),
    ...(get("montoDescontar") ? { [f.deduct]: get("montoDescontar") } : {}),
  };
}

export function normalizeMoneyRequest(answers: AnswersByName): MoneyRequestFields {
  const f = MONEY_FORM_FIELDS;
  const name = answers[f.name] && typeof answers[f.name] === "object" ? (answers[f.name] as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(answers[f.email]).toLowerCase();
  const amountCents = parseMoneyCents(answers[f.amount]);
  const type = parseRequestType(answers[f.type]);
  // Si el formulario no trae el monto a descontar, se calcula igual que JotForm.
  const deductCents =
    parseMoneyCents(answers[f.deduct]) ??
    (amountCents === null ? null : type === "prestamo" ? Math.round(amountCents * (1 + LOAN_SURCHARGE_PCT / 100)) : amountCents);
  return {
    firstName: titleCase(str(name.first)) || null,
    lastName: titleCase(str(name.last)) || null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    type,
    amountCents,
    deductCents,
  };
}
