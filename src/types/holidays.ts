/** Un día feriado (Settings → Feriados). Solo los `confirmado` cuentan en asistencia. */
export type HolidayStatus = "confirmado" | "pendiente" | "descartado";

export interface Holiday {
  date: string;
  name: string;
  source: "manual" | "feriados_io";
  status: HolidayStatus;
  /** false = feriados.io dice que no es descanso obligatorio para el sector privado. */
  mandatoryRest: boolean | null;
  irrenunciable: boolean | null;
  /** Si se trasladó: la fecha que conmemora. */
  originalDate: string | null;
  /** Ya no aparece en feriados.io. */
  missingFromSource: boolean;
}
