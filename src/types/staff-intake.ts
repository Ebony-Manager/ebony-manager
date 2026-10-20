import type { IntakeFields } from "@/lib/personal/jotform-intake";

/** Un registro del formulario de JotForm esperando revisión en Staff. */
export interface StaffIntake extends IntakeFields {
  id: string;
  submissionId: string;
  /** Cuándo llegó (ISO). */
  receivedAt: string;
}
