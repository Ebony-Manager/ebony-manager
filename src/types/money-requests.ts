import type { MoneyRequestFields } from "@/lib/personal/jotform-money";

/** Una solicitud de adelanto o préstamo, ya aprobada en JotForm, por registrar. */
export interface MoneyRequest extends MoneyRequestFields {
  id: string;
  submissionId: string;
  /** Cuándo llegó (ISO). */
  receivedAt: string;
}
