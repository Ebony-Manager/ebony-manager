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

export interface AchRow {
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

export type AchProblem = "no_id" | "no_route" | "no_account" | "no_account_type";

export interface AchEmployeeInput {
  employeeId: string;
  name: string;
  idDocument: string | null;
  bankRoutingCode: string | null;
  bankAccountNumber: string | null;
  bankAccountType: AchAccountType | null;
  paymentMethod: string;
  /** Neto a pagar de la quincena, en centavos. */
  netCents: number;
}

export interface AchPayload {
  /** Filas completas, listas para el archivo. */
  rows: AchRow[];
  /** Empleados que SE PAGAN por transferencia pero les falta algún dato:
   *  no entran al archivo hasta completarlos. */
  incomplete: { employeeId: string; name: string; netCents: number; problems: AchProblem[] }[];
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

export function buildAchPayload(items: readonly AchEmployeeInput[], addendaText: string): AchPayload {
  const addenda = buildAddenda(addendaText);
  const payload: AchPayload = { rows: [], incomplete: [], skipped: [], totalCents: 0 };

  for (const e of items) {
    if (e.paymentMethod !== "transferencia") {
      payload.skipped.push({ employeeId: e.employeeId, name: e.name, reason: "not_transfer" });
      continue;
    }
    if (e.netCents <= 0) {
      payload.skipped.push({ employeeId: e.employeeId, name: e.name, reason: "zero" });
      continue;
    }
    const id = (e.idDocument ?? "").trim();
    const route = (e.bankRoutingCode ?? "").replace(/\s+/g, "");
    const account = (e.bankAccountNumber ?? "").replace(/\s+/g, "");
    const problems: AchProblem[] = [];
    if (!id) problems.push("no_id");
    if (!route) problems.push("no_route");
    if (!account) problems.push("no_account");
    if (!e.bankAccountType) problems.push("no_account_type");
    if (problems.length > 0) {
      payload.incomplete.push({ employeeId: e.employeeId, name: e.name, netCents: e.netCents, problems });
      continue;
    }
    payload.rows.push({
      id,
      name: sanitizeAchText(e.name),
      route,
      account,
      accountType: ACH_ACCOUNT_TYPE_CODE[e.bankAccountType as AchAccountType],
      amount: Math.round(e.netCents) / 100,
      transType: "C",
      addenda,
    });
    payload.totalCents += Math.round(e.netCents);
  }
  return payload;
}

/** Nombre del archivo como lo deja la plantilla: `ACH-FILE  _D-M-AAAA.xls`
 *  (dos espacios, sin ceros a la izquierda en día y mes). */
export function achFileName(date: Date): string {
  return `ACH-FILE  _${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.xls`;
}
