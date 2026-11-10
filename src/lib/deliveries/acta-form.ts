/**
 * El formulario "Acta de Entrega" de JotForm. Se llena al entregar (el
 * cliente firma) y JotForm arma el PDF de condiciones. La app lo abre con el
 * proyecto, la dirección y el cliente ya puestos, y al llegar el envío lo
 * registra en el proyecto. Los campos se reconocen por su etiqueta o su
 * nombre ("Nombre Proyecto" / "nombreProyecto"), sin depender de ids.
 */

export const ACTA_FORM_ID = "230237298346864";
export const ACTA_FORM_URL = `https://form.jotform.com/${ACTA_FORM_ID}`;

/**
 * Los formularios que caen en un proyecto: acta de entrega (la firma el
 * cliente) y las autorizaciones de taller a pintura y a embalaje. Mismo
 * flujo: registro en el proyecto (por el nombre) y PDF + fotos en Drive.
 */
export type DeliveryKind = "entrega" | "pintura" | "embalaje";
export const DELIVERY_KINDS: DeliveryKind[] = ["entrega", "pintura", "embalaje"];
export const DELIVERY_FORMS: Record<DeliveryKind, { formId: string; folder: string; title: string }> = {
  entrega: { formId: ACTA_FORM_ID, folder: "ACTAS DE ENTREGA", title: "Acta de entrega" },
  pintura: { formId: "251893102532149", folder: "AUTORIZACIONES PINTURA", title: "Autorización a pintura" },
  embalaje: { formId: "252224493029859", folder: "AUTORIZACIONES EMBALAJE", title: "Autorización a embalaje" },
};
export const formUrl = (kind: DeliveryKind) => `https://form.jotform.com/${DELIVERY_FORMS[kind].formId}`;
export function kindForForm(formId: string): DeliveryKind | null {
  return DELIVERY_KINDS.find((k) => DELIVERY_FORMS[k].formId === formId) ?? null;
}

/** "Nombre Proyecto", "nombreProyecto", "Dirección" → "nombreproyecto", "direccion". */
export const fieldKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const FIELDS = {
  project: ["nombreproyecto", "proyecto"],
  address: ["direccion", "direccionproyecto"],
  clientName: ["nombrecliente", "cliente"],
  email: ["email", "correo", "correoelectronico"],
  idDoc: ["cedulaopasaporte", "cedula", "pasaporte"],
  items: ["itemsentregados", "items", "mobiliario"],
  photos: ["fotografiasentrega", "fotografias", "fotosmobiliario", "fotos"],
  date: ["date", "fecha"],
  approvedBy: ["aprobadopor"],
  receivedBy: ["recibidopor"],
  notes: ["observacionestecnicas", "observaciones"],
} as const;

/** Datos sueltos de las autorizaciones que se muestran tal cual (etiqueta → claves). */
const DETAILS: { label: string; keys: string[] }[] = [
  { label: "Tipo de mobiliario", keys: ["tipomobiliario"] },
  { label: "Acabado", keys: ["acabado"] },
  { label: "Código de color", keys: ["codigocolor"] },
  { label: "Piezas", keys: ["qtypiezas"] },
  { label: "Entrega final", keys: ["fechaentregafinal"] },
];
type FieldName = keyof typeof FIELDS;

export interface ActaQuestion {
  name: string;
  text: string;
  type: string;
}

/** La pregunta del nombre del proyecto (para llenar su lista de opciones). */
export function projectQuestion(questions: ActaQuestion[]): ActaQuestion | null {
  return findQuestion(questions, "project");
}

/** La pregunta del formulario para un campo (por etiqueta o nombre). */
function findQuestion(questions: ActaQuestion[], field: FieldName): ActaQuestion | null {
  const keys: readonly string[] = FIELDS[field];
  for (const k of keys) {
    const q = questions.find((x) => fieldKey(x.text) === k || fieldKey(x.name) === k);
    if (q) return q;
  }
  return null;
}

/** Valor para el enlace de JotForm según el tipo de campo (nombre completo y dirección van por partes). */
function prefillParams(q: ActaQuestion, value: string): [string, string][] {
  if (q.type === "control_fullname") {
    const parts = value.trim().split(/\s+/);
    const first = parts.length > 1 ? parts.slice(0, Math.ceil(parts.length / 2)).join(" ") : value;
    const last = parts.length > 1 ? parts.slice(Math.ceil(parts.length / 2)).join(" ") : "";
    return [
      [`${q.name}[first]`, first],
      [`${q.name}[last]`, last],
    ];
  }
  if (q.type === "control_address") return [[`${q.name}[addr_line1]`, value]];
  return [[q.name, value]];
}

/** El enlace al formulario con lo que la app ya sabe del proyecto. */
export function actaPrefillUrl(
  questions: ActaQuestion[],
  values: { project: string; address?: string | null; clientName?: string | null; email?: string | null },
  base: string = ACTA_FORM_URL
): string {
  const params = new URLSearchParams();
  const put = (field: FieldName, value: string | null | undefined) => {
    const q = value ? findQuestion(questions, field) : null;
    if (q && value) for (const [k, v] of prefillParams(q, value)) params.append(k, v);
  };
  put("project", values.project);
  put("address", values.address);
  put("clientName", values.clientName);
  put("email", values.email);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ---------------------------------------------------------------------------
// Lo que llega en un envío.

/** Respuestas por clave normalizada (etiqueta y nombre), venga de la API o del webhook. */
export type ActaAnswers = Map<string, unknown>;

/** Desde la API de JotForm: `{ "3": { name, text, answer, prettyFormat } }`. */
export function actaAnswersFromApi(answers: Record<string, { name?: string; text?: string; answer?: unknown; prettyFormat?: string }>): ActaAnswers {
  const out: ActaAnswers = new Map();
  for (const q of Object.values(answers)) {
    if (!q || q.answer === undefined) continue;
    const value = typeof q.prettyFormat === "string" && typeof q.answer === "object" && !Array.isArray(q.answer) ? { ...(q.answer as object), __pretty: q.prettyFormat } : q.answer;
    if (q.text) out.set(fieldKey(q.text), value);
    if (q.name) out.set(fieldKey(q.name), value);
  }
  return out;
}

/** Desde el `rawRequest` del webhook: `{ "q3_nombreProyecto": ... }`. */
export function actaAnswersFromRaw(raw: Record<string, unknown>): ActaAnswers {
  const out: ActaAnswers = new Map();
  for (const [key, value] of Object.entries(raw)) {
    const m = /^q\d+_(.+)$/.exec(key);
    if (m) out.set(fieldKey(m[1]), value);
  }
  return out;
}

/** Espacios de más fuera, pero los saltos de línea (una lista de ítems) se mantienen. */
const clean = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

/** Cualquier respuesta a texto: nombre completo, dirección, listas, tablas. */
export function answerText(v: unknown): string {
  if (v === null || v === undefined) return "";
  // Lista configurable de JotForm: llega como texto JSON `[{"Item(s)":"Cocina"},…]` → una línea por fila.
  if (typeof v === "string" && /^\s*\[\s*\{/.test(v)) {
    try {
      const rows = JSON.parse(v) as unknown;
      if (Array.isArray(rows)) return rows.map(answerText).filter(Boolean).join("\n");
    } catch {
      // no era JSON: va como texto
    }
  }
  if (typeof v === "string" || typeof v === "number") return clean(String(v));
  if (Array.isArray(v)) return v.map(answerText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.__pretty === "string") return clean(o.__pretty.replace(/<br\s*\/?>/gi, " "));
    if ("first" in o || "last" in o) return clean([o.prefix, o.first, o.middle, o.last].map(answerText).filter(Boolean).join(" "));
    if ("addr_line1" in o) return clean([o.addr_line1, o.addr_line2, o.city, o.state].map(answerText).filter(Boolean).join(", "));
    if ("year" in o && "month" in o && "day" in o) return `${o.year}-${String(o.month).padStart(2, "0")}-${String(o.day).padStart(2, "0")}`;
    return Object.values(o).map(answerText).filter(Boolean).join(" · ");
  }
  return "";
}

/** "2026-11-10", "11-10-2026", "10/11/2026"… → "2026-11-10" (o null). JotForm usa MM-DD-YYYY por defecto. */
export function answerDate(v: unknown): string | null {
  const s = answerText(v);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

/** Las direcciones de los archivos subidos (fotos). */
export function answerFiles(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\s*\n\s*|\s*,\s*(?=https?:)/) : [];
  return list.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim())).map((u) => u.trim());
}

export interface ActaSubmission {
  approvedBy: string | null;
  receivedBy: string | null;
  notes: string | null;
  /** Etiqueta → valor (acabado, color, piezas…). */
  details: Record<string, string>;
  projectName: string;
  address: string | null;
  clientName: string | null;
  email: string | null;
  idDoc: string | null;
  items: string | null;
  date: string | null;
  photos: string[];
}

function get(answers: ActaAnswers, field: FieldName): unknown {
  for (const k of FIELDS[field]) if (answers.has(k)) return answers.get(k);
  return undefined;
}

export function normalizeActa(answers: ActaAnswers): ActaSubmission {
  const text = (f: FieldName) => answerText(get(answers, f)) || null;
  const details: Record<string, string> = {};
  for (const d of DETAILS) {
    const key = d.keys.find((k) => answers.has(k));
    const value = key ? (d.label === "Entrega final" ? (answerDate(answers.get(key)) ?? answerText(answers.get(key))) : answerText(answers.get(key))) : "";
    if (value) details[d.label] = value;
  }
  return {
    approvedBy: text("approvedBy"),
    receivedBy: text("receivedBy"),
    notes: text("notes"),
    details,
    projectName: answerText(get(answers, "project")),
    address: text("address"),
    clientName: text("clientName"),
    email: text("email"),
    idDoc: text("idDoc"),
    items: text("items"),
    date: answerDate(get(answers, "date")),
    photos: answerFiles(get(answers, "photos")),
  };
}
