/**
 * Formulario "Registro Empleado" de JotForm → datos de una ficha del staff.
 * Puro (sin red ni Supabase) y probado: el webhook (`/api/jotform/webhook`)
 * lo usa para guardar cada respuesta en la bandeja de Staff ya en el formato
 * de la app (teléfono "6822-6012", cuenta "04-02-98-968313-7", país, etc.).
 *
 * JotForm manda las respuestas de dos formas: la API (`answers`, por número
 * de pregunta con su `name`) y el `rawRequest` del webhook (claves
 * `q3_nombre`). Las dos se llevan a un mismo mapa por nombre de campo.
 */

/** Formulario de JotForm que alimenta la bandeja de Staff. */
export const EMPLOYEE_FORM_ID = "232606019835052";

/** Nombre de cada campo en ese formulario (el `name` de la pregunta en JotForm). */
export const EMPLOYEE_FORM_FIELDS = {
  name: "nombre",
  email: "correoElectronico",
  phone: "celular",
  birthDate: "fechaNacimiento",
  address: "domicilio",
  idDocument: "cedulaO",
  bankName: "nombreBanco",
  bankAccountType: "tipoDe",
  bankAccountNumber: "numeroDe",
  emergencyName: "nombre8",
  emergencyPhone: "telefono",
  emergencyRelation: "relacionCon",
} as const;

/** Respuestas por nombre de campo. */
export type AnswersByName = Record<string, unknown>;

export interface IntakeFields {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** `YYYY-MM-DD`. */
  birthDate: string | null;
  address: string | null;
  /** Enlace a la foto de la cédula o pasaporte que subió (en JotForm). */
  idDocumentUrl: string | null;
  bankName: string | null;
  bankAccountType: "ahorro" | "corriente" | null;
  bankAccountNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
}

/** Desde la API de JotForm: `{ "3": { name: "nombre", answer: {...} }, ... }`. */
export function answersFromApi(answers: Record<string, { name?: string; answer?: unknown }>): AnswersByName {
  const out: AnswersByName = {};
  for (const q of Object.values(answers)) {
    if (q?.name && q.answer !== undefined) out[q.name] = q.answer;
  }
  return out;
}

/** Desde el `rawRequest` del webhook: `{ "q3_nombre": {...}, ... }`. */
export function answersFromRawRequest(raw: Record<string, unknown>): AnswersByName {
  const out: AnswersByName = {};
  for (const [key, value] of Object.entries(raw)) {
    const m = /^q\d+_(.+)$/.exec(key);
    if (m) out[m[1]] = value;
  }
  return out;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\s+/g, " ").trim() : "");
const orNull = (s: string): string | null => s || null;

const LOWER_WORDS = new Set(["de", "del", "la", "las", "los", "y"]);

/** "romina  ALFONSO de la cruz" → "Romina Alfonso de la Cruz". */
export function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLocaleLowerCase("es");
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
    })
    .join(" ");
}

/**
 * Teléfono como lo guarda la app: los de Panamá "6822-6012" (8 dígitos) o
 * "266-3777" (7); los de afuera "(+57) 301-2809820".
 */
export function formatPhone(value: unknown): string | null {
  let area = "";
  let number = "";
  if (value && typeof value === "object") {
    const o = obj(value);
    area = str(o.area).replace(/\D/g, "");
    number = str(o.phone).replace(/\D/g, "");
    if (!number) number = str(o.full).replace(/\D/g, "");
  } else {
    number = str(value).replace(/\D/g, "");
  }
  if (!number) return null;
  // Alguien que escribe el código de país dentro del número.
  if (!area && number.length > 8 && number.startsWith("507")) {
    area = "507";
    number = number.slice(3);
  }
  if (!area || area === "507") {
    if (number.length === 8) return `${number.slice(0, 4)}-${number.slice(4)}`;
    if (number.length === 7) return `${number.slice(0, 3)}-${number.slice(3)}`;
    return number;
  }
  return `(+${area}) ${number.length === 10 ? `${number.slice(0, 3)}-${number.slice(3)}` : number}`;
}

/** Fecha de un campo de fecha de JotForm (`{day, month, year}` o `datetime`). */
export function parseJotformDate(value: unknown): string | null {
  const o = obj(value);
  let y = str(o.year);
  let m = str(o.month);
  let d = str(o.day);
  const dt = str(o.datetime) || (typeof value === "string" ? value.trim() : "");
  if ((!y || !m || !d) && /^\d{4}-\d{2}-\d{2}/.test(dt)) [y, m, d] = dt.slice(0, 10).split("-");
  if (!/^\d{4}$/.test(y) || !/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return null;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Dirección en una línea, sin repetir partes ("Panamá, Panama"). */
export function formatAddress(value: unknown): string | null {
  const o = obj(value);
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const key of ["addr_line1", "addr_line2", "city", "state"]) {
    const part = str(o[key]).replace(/^[,\s]+|[,\s]+$/g, "");
    const norm = part.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");
    if (part && !seen.has(norm)) {
      seen.add(norm);
      parts.push(part);
    }
  }
  if (parts.length === 0 && typeof value === "string") return orNull(str(value));
  return parts.length ? parts.join(", ") : null;
}

const BANKS: [RegExp, string][] = [
  [/general/i, "Banco General"],
  [/banis?t?mo/i, "Banistmo"],
  [/lafise/i, "Banco Lafise"],
  [/credi?o?matic|\bbac\b/i, "BAC Credomatic"],
  [/nacional/i, "Banco Nacional"],
  [/caja de ahorros/i, "Caja de Ahorros"],
  [/global/i, "Global Bank"],
  [/multibank/i, "Multibank"],
];

/** "General", "banco general" → "Banco General". Lo desconocido, como vino. */
export function normalizeBankName(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  return BANKS.find(([re]) => re.test(s))?.[1] ?? titleCase(s);
}

/** Banco General usa 13 dígitos: "0402989683137" → "04-02-98-968313-7". Los demás, solo dígitos. */
export function formatBankAccount(raw: unknown, bankName: string | null): string | null {
  const digits = str(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (bankName === "Banco General" && digits.length === 13) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 12)}-${digits.slice(12)}`;
  }
  return digits;
}

export function parseAccountType(raw: unknown): IntakeFields["bankAccountType"] {
  const s = str(raw).toLowerCase();
  if (s.includes("ahorro")) return "ahorro";
  if (s.includes("corriente")) return "corriente";
  return null;
}

function firstUrl(value: unknown): string | null {
  const list = Array.isArray(value) ? value : [value];
  const url = list.map(str).find((u) => /^https?:\/\//.test(u));
  return url ?? null;
}

function email(value: unknown): string | null {
  const s = str(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

/** Respuestas del formulario de registro → datos de la ficha. */
export function normalizeIntake(answers: AnswersByName): IntakeFields {
  const f = EMPLOYEE_FORM_FIELDS;
  const name = obj(answers[f.name]);
  const emergency = obj(answers[f.emergencyName]);
  const bankName = normalizeBankName(answers[f.bankName]);
  return {
    firstName: orNull(titleCase(str(name.first))),
    lastName: orNull(titleCase(str(name.last))),
    email: email(answers[f.email]),
    phone: formatPhone(answers[f.phone]),
    birthDate: parseJotformDate(answers[f.birthDate]),
    address: formatAddress(answers[f.address]),
    idDocumentUrl: firstUrl(answers[f.idDocument]),
    bankName,
    bankAccountType: parseAccountType(answers[f.bankAccountType]),
    bankAccountNumber: formatBankAccount(answers[f.bankAccountNumber], bankName),
    emergencyContactName: orNull(titleCase([str(emergency.first), str(emergency.last)].filter(Boolean).join(" "))),
    emergencyContactPhone: formatPhone(answers[f.emergencyPhone]),
    emergencyContactRelation: orNull(str(answers[f.emergencyRelation])),
  };
}

/** Para comparar nombres sin importar acentos, mayúsculas ni espacios de más. */
export function nameKey(name: string): string {
  return name
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchCandidate {
  kind: "employee" | "contractor";
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/**
 * ¿Ya está en el staff? Por correo, por teléfono o por nombre: el nombre
 * completo igual, o el nombre y el primer apellido (en el sistema muchos
 * están como "Jose Salcedo" y en el formulario "José Ricardo Salcedo Serna").
 */
export function findStaffMatch(intake: Pick<IntakeFields, "firstName" | "lastName" | "email" | "phone">, people: readonly MatchCandidate[]): MatchCandidate | null {
  if (intake.email) {
    const byEmail = people.find((p) => p.email?.toLowerCase() === intake.email);
    if (byEmail) return byEmail;
  }
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-8);
  if (intake.phone && digits(intake.phone).length === 8) {
    const byPhone = people.find((p) => digits(p.phone) === digits(intake.phone));
    if (byPhone) return byPhone;
  }
  const first = nameKey(intake.firstName ?? "").split(" ")[0];
  const firstSurname = nameKey(intake.lastName ?? "").split(" ")[0];
  if (!first || !firstSurname) return null;
  const full = nameKey(`${intake.firstName} ${intake.lastName}`);
  return (
    people.find((p) => nameKey(p.name) === full) ??
    people.find((p) => {
      const words = nameKey(p.name).split(" ");
      return words[0] === first && words.includes(firstSurname);
    }) ??
    null
  );
}

/** Lo que una ficha (empleado o contratista) ya tiene, para no pisarlo. */
export interface PersonProfileFields {
  phone: string | null;
  email: string | null;
  address: string | null;
  birthDate: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankName: string | null;
  bankAccountType: "ahorro" | "corriente" | null;
  bankAccountNumber: string | null;
  notes: string | null;
}

/** Nota con el enlace a la foto del documento que subió en el formulario. */
export function idDocumentNote(url: string): string {
  return `Documento (JotForm): ${url}`;
}

/** El enlace de JotForm que quedó en las notas de una ficha (si el documento no se pudo copiar). */
export function jotformDocumentUrlFromNotes(notes: string | null | undefined): string | null {
  const m = /Documento \(JotForm\): (https:\/\/\S+)/.exec(notes ?? "");
  return m ? m[1] : null;
}

/** Las notas sin la línea del enlace de JotForm (ya está el documento en la ficha). null si quedan vacías. */
export function notesWithoutJotformDocument(notes: string | null | undefined): string | null {
  const rest = (notes ?? "")
    .split("\n")
    .filter((line) => !/^Documento \(JotForm\): https:\/\//.test(line.trim()))
    .join("\n")
    .trim();
  return rest || null;
}

/**
 * Completar a alguien que ya existe con su registro: solo se llenan los
 * campos VACÍOS (nunca se cambia un dato que ya estaba). La cuenta de banco
 * va completa o nada: solo si la ficha no tiene ninguna. El enlace al
 * documento se agrega a las notas.
 */
export function intakePatch(current: PersonProfileFields, intake: IntakeFields): Partial<PersonProfileFields> {
  const patch: Partial<PersonProfileFields> = {};
  const fill = <K extends "phone" | "email" | "address" | "birthDate" | "emergencyContactName" | "emergencyContactPhone">(key: K) => {
    if (!current[key] && intake[key]) patch[key] = intake[key];
  };
  fill("phone");
  fill("email");
  fill("address");
  fill("birthDate");
  fill("emergencyContactName");
  fill("emergencyContactPhone");
  const hasBank = Boolean(current.bankName || current.bankAccountType || current.bankAccountNumber);
  if (!hasBank && intake.bankAccountNumber) {
    patch.bankName = intake.bankName;
    patch.bankAccountType = intake.bankAccountType;
    patch.bankAccountNumber = intake.bankAccountNumber;
  }
  if (intake.idDocumentUrl && !(current.notes ?? "").includes(intake.idDocumentUrl)) {
    patch.notes = [current.notes?.trim(), idDocumentNote(intake.idDocumentUrl)].filter(Boolean).join("\n");
  }
  return patch;
}
