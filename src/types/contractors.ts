/**
 * Tipos de dominio del módulo Contratistas (camelCase) — separados de
 * `src/types/database.ts` (los Row/Insert/Update snake_case que genera
 * Supabase) a propósito: el servicio mapea de una forma a la otra y la
 * capa de cálculos (`src/lib/contractors/`) trabaja solo con estos.
 *
 * Es un módulo HERMANO de Planilla, no una extensión: un contratista no
 * es `PayrollEmployee` ni usuario de la app. No hay quincena ni
 * prestaciones — solo un estado de cuenta cuyo saldo SIEMPRE se computa
 * (ver `contractor-ledger.ts`), nunca se guarda.
 */

export type ContractorType = "ebanista" | "pintor";
export type ContractorStatus = "ACTIVE" | "INACTIVE";

/** Proyecto de Ebony (tabla `projects`). Ficha mínima en la C2: nombre,
 *  cliente, estado, notas. Los movimientos del estado de cuenta se
 *  enganchan por `projectId`. */
export type ProjectStatus = "ACTIVE" | "COMPLETED";

export interface Project {
  id: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
  notes: string | null;
  /** Campos de "contrato" (Etapa 2-A) — todos opcionales. */
  scope: string | null;
  furnitureType: string | null;
  materialColor: string | null;
  specs: string | null;
  paymentTerms: string | null;
  /** m² totales del proyecto. `numeric` en la base → number acá. */
  totalMt2: number | null;
}

export interface Contractor {
  id: string;
  name: string;
  contractorType: ContractorType;
  /** Número de cédula o pasaporte (el tipo va en `idDocumentType`). */
  idDocument: string | null;
  idDocumentType: "cedula" | "pasaporte" | null;
  /** Código de país ISO 3166-1 de dos letras (ver src/lib/countries.ts). */
  nationality: string | null;
  /** Fecha de nacimiento, `YYYY-MM-DD`. */
  birthDate: string | null;
  /** Ruta de la foto en el bucket privado `contractor-photos`; null = sin foto. */
  photoPath: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  contractInfo: string | null;
  bankName: string | null;
  bankAccountType: "ahorro" | "corriente" | null;
  bankAccountNumber: string | null;
  bankRoutingCode: string | null;
  startDate: string | null;
  status: ContractorStatus;
  endDate: string | null;
  notes: string | null;
  sortOrder: number;
}

/** Ayudante de un contratista, con su cuenta bancaria para pagarle. */
export interface ContractorHelper {
  id: string;
  contractorId: string;
  name: string;
  idDocument: string | null;
  phone: string | null;
  bankName: string | null;
  bankAccountType: "ahorro" | "corriente" | null;
  bankAccountNumber: string | null;
  notes: string | null;
}

/** Contratista + su saldo actual calculado (para el directorio). */
export interface ContractorWithBalance extends Contractor {
  balanceCents: number;
}

/** Las 9 categorías de la tabla `contractor_ledger_entries`. */
export type ContractorLedgerCategory =
  | "trabajo"
  | "bono"
  | "extra"
  | "pago"
  | "prestamo"
  | "adelanto"
  | "material"
  | "gasto_operativo"
  | "ajuste";

/** `a_favor` sube el saldo (Ebony le debe más al contratista); `reduce`
 *  lo baja. */
export type ContractorLedgerDirection = "a_favor" | "reduce";

export interface ContractorLedgerEntry {
  id: string;
  contractorId: string;
  /** FK al proyecto enganchado (C2). `clientText` queda como nota libre
   *  opcional (cliente final). Si el proyecto se borra, esto vuelve a
   *  null y el movimiento se conserva. */
  projectId: string | null;
  /** Nombre del proyecto enganchado, resuelto en el `select` del
   *  servicio — solo para mostrar, no se guarda. */
  projectName: string | null;
  entryDate: string;
  category: ContractorLedgerCategory;
  direction: ContractorLedgerDirection;
  mt2: number | null;
  costPerMt2Cents: number | null;
  /** Monto final congelado, magnitud SIEMPRE positiva; el sentido lo da
   *  `direction`. Si hay `mt2` y `costPerMt2Cents`, = mt2 × costo. */
  amountCents: number;
  /** Solo para `category = 'material'`. true = Ebony asume el material:
   *  el movimiento queda registrado pero NO mueve el saldo. */
  ebonyAbsorbsMaterial: boolean;
  clientText: string | null;
  description: string | null;
  notes: string | null;
  /** Resumen compacto de los ítems de trabajo del movimiento (si tiene),
   *  resuelto en el `select` del servicio — "Descripción (detalle), …".
   *  null cuando el movimiento no tiene ítems. Solo para mostrar en la
   *  tabla del estado de cuenta sin tener que abrir el movimiento. */
  itemsSummary: string | null;
}

/** Una fila del estado de cuenta con el saldo corrido justo después de
 *  ella — derivado, nunca guardado. */
export interface ContractorLedgerRow extends ContractorLedgerEntry {
  balanceAfterCents: number;
}

/** Catálogo de tarifas de mano de obra (tabla `labor_rates`), para armar
 *  ítems de trabajo en "Agregar Movimiento" (siguiente tanda). Un pintor
 *  cobra un precio único por ítem (`fase = null`); un ebanista tiene un
 *  precio por fase (armado / instalación). */
export type LaborRatePhase = "armado" | "instalacion";
export type LaborRateUnit = "m2" | "ml" | "unidad";

export interface LaborRate {
  id: string;
  contractorType: ContractorType;
  /** null solo para `contractorType === 'pintor'`. */
  fase: LaborRatePhase | null;
  unidad: LaborRateUnit;
  descripcion: string;
  /** Precio en centavos enteros — nunca floats para dinero. */
  precioCents: number;
  /** Inactivar en vez de borrar: conserva la tarifa que ya se usó en
   *  movimientos pasados. */
  activo: boolean;
  /** Orden manual de despliegue en el selector. */
  orden: number;
}

/** Línea de trabajo de un movimiento (categoría 'trabajo'), armada desde
 *  `labor_rates`. TODO congelado al momento de agregar el ítem — nunca
 *  un join en vivo — igual que `amountCents` en el movimiento dueño. */
export interface ContractorLedgerEntryItem {
  id: string;
  ledgerEntryId: string;
  /** Solo trazabilidad; null si la tarifa de origen se borró después. */
  laborRateId: string | null;
  descripcion: string;
  /** Nota opcional de la pieza específica de mueble a la que corresponde
   *  esta línea (ej. "Mueble de TV") — para cuando un mismo ítem del
   *  catálogo se factura varias veces en el mismo proyecto por piezas
   *  distintas. */
  detalle: string | null;
  fase: LaborRatePhase | null;
  unidad: LaborRateUnit;
  /** Precio de `labor_rates` AL MOMENTO de agregar el ítem — congelado,
   *  nunca cambia aunque la tarifa original cambie después. */
  precioUnitarioCents: number;
  cantidad: number;
  /** = round(cantidad × precioUnitarioCents), congelado igual que el
   *  precio unitario. */
  subtotalCents: number;
}
