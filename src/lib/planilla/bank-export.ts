/**
 * Archivo de pago de planilla para la banca en línea (carga masiva ACH),
 * con el formato de la plantilla `TR_ACH` que usa Ebony:
 *
 *   ID BENEFICIARIO | NOMBRE BENEFICIARIO | RUTA BANCO | CUENTA BANCO |
 *   TIPO CUENTA | MONTO | TIPO TRANS. | ADENDA
 *
 * Esta capa es PURA (sin red ni archivos): arma las filas, valida qué
 * empleados tienen todos los datos y suma el total. La descarga real
 * vive en `app/(app)/planilla/export/ach/route.ts`, y la vista previa de
 * Registro usa estas mismas funciones, así lo que se ve es lo que se baja.
 */

export type AchAccountType = "corriente" | "ahorro";

/** Código que va en la columna TIPO CUENTA para cada tipo de cuenta.
 *  ⚠ La plantilla viene vacía y no trae ejemplos: estos son los códigos
 *  habituales del ACH panameño (03 corriente, 04 ahorros) y hay que
 *  confirmarlos con una fila real antes de usar el archivo en producción. */
export const ACH_ACCOUNT_TYPE_CODE: Record<AchAccountType, string> = {
  corriente: "03",
  ahorro: "04",
};

/** Texto por defecto de la ADENDA (la plantilla trae "Paga Plamilla"). */
export const ACH_DEFAULT_ADDENDA_TEXT = "Pago de Planilla";

/** Qué se está pagando en una fila: la quincena o cada prestación por
 *  separado (cada una sale como su propia transferencia). */
export type AchConcept = "quincena" | "decimo" | "vacacion" | "prima";

export const ACH_CONCEPT_ORDER: AchConcept[] = ["quincena", "decimo", "vacacion", "prima"];

/** Texto de la ADENDA de cada prestación (la de la quincena la escribe el usuario). */
export const ACH_BENEFIT_ADDENDA_TEXT: Record<Exclude<AchConcept, "quincena">, string> = {
  decimo: "Pago de Decimo",
  vacacion: "Pago de Vacaciones",
  prima: "Pago de Prima de Antiguedad",
};

export interface AchRow {
  employeeId: string;
  concept: AchConcept;
  id: string;
  name: string;
  route: string;
  account: string;
  accountType: string;
  /** Dólares con 2 decimales. */
  amount: number;
  transType: "C";
  addenda: string;
}

/** Lo que BLOQUEA a un empleado. La ruta del banco NO bloquea: es la misma
 *  para todos y se pone una sola vez (o se deja vacía hasta tenerla). */
export type AchProblem = "no_id" | "no_account" | "no_account_type";

export interface AchEmployeeInput {
  employeeId: string;
  name: string;
  idDocument: string | null;
  bankRoutingCode: string | null;
  bankAccountNumber: string | null;
  bankAccountType: AchAccountType | null;
  paymentMethod: string;
  /** Neto a pagar de la quincena, en centavos. INCLUYE lo que se paga de
   *  prestaciones esa quincena: el archivo lo separa en transferencias distintas. */
  netCents: number;
  /** Prestaciones pagadas en esta quincena (ya incluidas en `netCents`). */
  benefits?: { decimoCents: number; vacationCents: number; primaCents: number };
  /** Si las prestaciones las paga otra empresa (la persona las recibe de ella):
   *  se descuentan de este archivo, que solo lleva lo que paga Ebony. */
  benefitsPaidExternally?: boolean;
}

export interface AchPayload {
  /** Filas completas, listas para el archivo. */
  rows: AchRow[];
  /** Empleados que SE PAGAN por transferencia pero les falta algún dato:
   *  no entran al archivo hasta completarlos. */
  incomplete: { employeeId: string; name: string; netCents: number; problems: AchProblem[] }[];
  /** Cuánto se paga por cada concepto (para llevar el control de cada cosa). */
  totalsByConcept: Record<AchConcept, { count: number; cents: number }>;
  /** Empleados que no entran por no ser transferencia o tener neto 0. */
  skipped: { employeeId: string; name: string; reason: "not_transfer" | "zero" }[];
  totalCents: number;
}

/** Mayúsculas, sin acentos ni símbolos raros: lo más seguro para un ACH. */
export function sanitizeAchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,&'\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** `REF*TXT**<texto>\` — el formato de la ADENDA de la plantilla. Se quitan
 *  `*` y `\` del texto para no romper el formato. */
export function buildAddenda(text: string): string {
  const clean = text.replace(/[*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return `REF*TXT**${clean || ACH_DEFAULT_ADDENDA_TEXT}\\`;
}

export function buildAchPayload(
  items: readonly AchEmployeeInput[],
  addendaText: string,
  /** Ruta del banco para quien no tenga una propia (normalmente la misma para
   *  todos). Vacía = la columna RUTA BANCO sale vacía. */
  defaultRoute = "",
  /** Textos de la ADENDA de cada prestación (por defecto "Pago de Decimo"…). */
  benefitAddendaText: Partial<Record<Exclude<AchConcept, "quincena">, string>> = {}
): AchPayload {
  const payload: AchPayload = {
    rows: [],
    incomplete: [],
    skipped: [],
    totalCents: 0,
    totalsByConcept: {
      quincena: { count: 0, cents: 0 },
      decimo: { count: 0, cents: 0 },
      vacacion: { count: 0, cents: 0 },
      prima: { count: 0, cents: 0 },
    },
  };

  for (const e of items) {
    if (e.paymentMethod !== "transferencia") {
      payload.skipped.push({ employeeId: e.employeeId, name: e.name, reason: "not_transfer" });
      continue;
    }
    const b = e.benefits ?? { decimoCents: 0, vacationCents: 0, primaCents: 0 };
    const benefitsTotal = b.decimoCents + b.vacationCents + b.primaCents;
    // Cada concepto, por separado. La quincena es lo que queda al quitar las
    // prestaciones; las prestaciones que paga otra empresa no entran al archivo.
    const lines: { concept: AchConcept; cents: number }[] = [
      { concept: "quincena" as const, cents: e.netCents - benefitsTotal },
      ...(e.benefitsPaidExternally
        ? []
        : [
            { concept: "decimo" as const, cents: b.decimoCents },
            { concept: "vacacion" as const, cents: b.vacationCents },
            { concept: "prima" as const, cents: b.primaCents },
          ]),
    ].filter((l) => l.cents > 0);
    if (lines.length === 0) {
      payload.skipped.push({ employeeId: e.employeeId, name: e.name, reason: "zero" });
      continue;
    }
    const id = (e.idDocument ?? "").trim();
    const route = (e.bankRoutingCode ?? "").replace(/\s+/g, "") || defaultRoute.replace(/\s+/g, "");
    const account = (e.bankAccountNumber ?? "").replace(/\s+/g, "");
    const problems: AchProblem[] = [];
    if (!id) problems.push("no_id");
    if (!account) problems.push("no_account");
    if (!e.bankAccountType) problems.push("no_account_type");
    if (problems.length > 0) {
      payload.incomplete.push({
        employeeId: e.employeeId,
        name: e.name,
        netCents: lines.reduce((s, l) => s + l.cents, 0),
        problems,
      });
      continue;
    }
    for (const line of lines) {
      const text =
        line.concept === "quincena"
          ? addendaText
          : (benefitAddendaText[line.concept] ?? ACH_BENEFIT_ADDENDA_TEXT[line.concept]);
      payload.rows.push({
        employeeId: e.employeeId,
        concept: line.concept,
        id,
        name: sanitizeAchText(e.name),
        route,
        account,
        accountType: ACH_ACCOUNT_TYPE_CODE[e.bankAccountType as AchAccountType],
        amount: Math.round(line.cents) / 100,
        transType: "C",
        addenda: buildAddenda(text),
      });
      payload.totalCents += Math.round(line.cents);
      payload.totalsByConcept[line.concept].count += 1;
      payload.totalsByConcept[line.concept].cents += Math.round(line.cents);
    }
  }
  return payload;
}

/** Nombre del archivo como lo deja la plantilla: `ACH-FILE  _D-M-AAAA.xls`
 *  (dos espacios, sin ceros a la izquierda en día y mes). */
export function achFileName(date: Date): string {
  return `ACH-FILE  _${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.xls`;
}
