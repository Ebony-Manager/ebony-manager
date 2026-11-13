"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { DayResult } from "@/lib/attendance/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateCompact } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { resolveAttendanceDayAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { FormSection } from "@/components/shared/form-section";
import { ICON } from "@/lib/ui/concepts";

const toHHMM = (m: number | null | undefined) => (m === null || m === undefined ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const fromHHMM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Revisar un día de asistencia: la hora real de entrada y/o salida (lo que se
 * sabe por la persona o la jefa de taller) y una nota. Manda sobre las
 * ponchadas de ese día. "No vino" confirma la falta (se descuenta el día).
 */
export function AttendanceDayDialog({
  open,
  onOpenChange,
  employee,
  day,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string };
  day: DayResult | null;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const [arrival, setArrival] = React.useState("");
  const [departure, setDeparture] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"arrival" | "departure">();
  const seed = React.useRef("");

  /* eslint-disable react-hooks/set-state-in-effect -- siembra el formulario al abrir. */
  React.useEffect(() => {
    if (!open || !day) return;
    setArrival(toHHMM(day.resolution ? day.resolution.arrival ?? day.arrival : day.arrival));
    setDeparture(toHHMM(day.resolution ? day.resolution.departure ?? day.departure : day.departure));
    setNote(day.resolution?.note ?? "");
    seed.current = JSON.stringify([toHHMM(day.resolution ? day.resolution.arrival ?? day.arrival : day.arrival), toHHMM(day.resolution ? day.resolution.departure ?? day.departure : day.departure), day.resolution?.note ?? ""]);
    reset();
  }, [open, day, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!day) return null;
  const isToday = day.date === todayInPanama();

  async function save(a: number | null, d: number | null) {
    setSubmitting(true);
    try {
      await resolveAttendanceDayAction({ employeeId: employee.id, date: day!.date, arrival: a, departure: d, note: note.trim() || null });
      toast.success(tg("att_day_saved"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Asistencia: no se pudo guardar la revisión del día", err);
      toast.error(tg("att_day_error"));
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    const a = fromHHMM(arrival);
    const d = fromHHMM(departure);
    // Hoy (todavía no se va): basta la entrada; la salida se anota después o la trae el reloj.
    if (isToday && a !== null && d === null) {
      void save(a, null);
      return;
    }
    // Ante la duda, a favor de la empresa: un día que ya pasó necesita las dos horas.
    const missingOut = isToday ? false : d === null;
    if (
      !validate([
        ["arrival", a === null, isToday ? tg("att_day_need_in") : tg("att_day_need_both")],
        ["departure", missingOut || (a !== null && d !== null && d <= a), missingOut ? tg("att_day_need_both") : tg("att_day_order")],
      ])
    )
      return;
    void save(a!, d!);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${employee.name} · ${formatDateCompact(lang, day.date)}`}
      description={tg("att_day_desc")}
      onSubmit={submit}
      submitting={submitting}
      submitLabel={tg("att_day_save")}
      dirty={() => JSON.stringify([arrival, departure, note]) !== seed.current}
    >
      {/* min-w-0: en el iPhone el campo de hora no se encoge solo y se montaban uno sobre otro. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={tg("att_in")} required className="min-w-0" error={error("arrival")}>
          <Input
            type="time"
            value={arrival}
            onChange={(e) => {
              setArrival(e.target.value);
              clear("arrival");
            }} className="w-full min-w-0 appearance-none" />
        </Field>
        <Field label={isToday ? `${tg("att_out")} · ${tg("att_day_out_later")}` : tg("att_out")} required={!isToday} className="min-w-0" error={error("departure")}>
          <Input
            type="time"
            value={departure}
            onChange={(e) => {
              setDeparture(e.target.value);
              clear("departure");
            }} className="w-full min-w-0 appearance-none" />
        </Field>
      </div>
      <Field label={tg("att_day_note")}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tg("att_day_note_ph")} />
      </Field>
      <FormSection quiet icon={ICON.date} title={tg("att_day_absent")}>
        <span className="text-xs text-muted-foreground">{tg("att_day_absent_hint")}</span>
        <Button type="button" size="sm" variant="outline" className="self-start" disabled={submitting} onClick={() => void save(null, null)}>
          {tg("att_day_absent")}
        </Button>
      </FormSection>
    </FormDialog>
  );
}
