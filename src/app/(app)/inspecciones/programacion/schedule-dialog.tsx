"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { InspectionSchedule, ScheduleItem, SchedulePerson } from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../contratistas/field";
import { scheduleItemsAction } from "../actions";
import { useTi, type InspeccionesKey } from "../shared";

/**
 * Programar (o reprogramar) detalles: quién lo atiende (contratistas o
 * empleados, cualquiera; en pintura salen primero los pintores), qué día y una
 * nota para ese día. Van al final de la lista de esa persona en ese día.
 */
export function ScheduleDialog({
  request,
  people,
  items,
  defaultDate,
  onClose,
  onDone,
}: {
  request: { itemIds: string[]; from?: InspectionSchedule } | null;
  people: SchedulePerson[];
  items: ReadonlyMap<string, ScheduleItem>;
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { ti } = useTi();
  const open = request !== null;
  const [person, setPerson] = React.useState("");
  const [date, setDate] = React.useState(defaultDate);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!request) return;
    setPerson(request.from ? `${request.from.personKind}:${request.from.personId}` : "");
    setDate(request.from?.date ?? defaultDate);
    setNote(request.from?.note ?? "");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const list = (request?.itemIds ?? []).map((id) => items.get(id)).filter((i): i is ScheduleItem => !!i);
  // En pintura, los pintores primero; en carpintería, los ebanistas.
  const prefer = list.every((i) => i.kind === "pintura") ? "pintor" : list.every((i) => i.kind === "carpinteria") ? "ebanista" : null;
  const contractors = people.filter((p) => p.kind === "contratista").sort((a, b) => Number(b.role === prefer) - Number(a.role === prefer) || a.name.localeCompare(b.name));
  const employees = people.filter((p) => p.kind === "empleado").sort((a, b) => a.name.localeCompare(b.name));
  const roleLabel = (r: string) => {
    const key = `sch_role_${r}` as InspeccionesKey;
    return ["pintor", "ebanista", "taller", "administrativo"].includes(r) ? ti(key) : r;
  };

  async function save() {
    const [kind, id] = person.split(":");
    if (!id || !date || list.length === 0) return;
    setSaving(true);
    const res = await scheduleItemsAction(
      list.map((i) => i.id),
      kind === "empleado" ? "empleado" : "contratista",
      id,
      date,
      note.trim() || null,
    );
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ti("sch_saved"));
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request?.from ? ti("sch_reschedule") : ti("sch_dialog_title", { n: list.length })}</DialogTitle>
          <DialogDescription className="line-clamp-3">
            {list.map((i) => `${i.projectName} · ${i.area?.trim() || i.comment}`).join(" — ")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={ti("sch_person")}>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={ti("sch_pick_person")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{ti("sch_group_contratistas")}</SelectLabel>
                  {contractors.map((p) => (
                    <SelectItem key={p.id} value={`contratista:${p.id}`}>
                      {p.name} <span className="text-muted-foreground">· {roleLabel(p.role)}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>{ti("sch_group_empleados")}</SelectLabel>
                  {employees.map((p) => (
                    <SelectItem key={p.id} value={`empleado:${p.id}`}>
                      {p.name} <span className="text-muted-foreground">· {roleLabel(p.role)}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field label={ti("sch_day")}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full min-w-0" />
          </Field>
          <Field label={ti("sch_note")}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ti("sch_note_ph")} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ti("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving || !person || !date}>
            {saving ? ti("sch_saving") : request?.from ? ti("sch_reschedule") : ti("sch_schedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
