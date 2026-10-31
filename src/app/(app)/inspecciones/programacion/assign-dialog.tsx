"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { InspectionSchedule, SchedulePerson } from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../contratistas/field";
import { assignSchedulesAction, setScheduleNoteAction } from "../actions";
import { useTi, type InspeccionesKey } from "../shared";

export interface AssignRequest {
  title: string;
  schedules: InspectionSchedule[];
  /** Pintura → los pintores primero; carpintería → los ebanistas. */
  prefer: "pintor" | "ebanista" | null;
  /** Con nota (un área de un día); sin ella al asignar toda una semana. */
  withNote: boolean;
}

const NONE = "none";

/** Lista de personas: contratistas (los del oficio primero) y empleados. */
export function PersonOptions({ people, prefer }: { people: SchedulePerson[]; prefer: "pintor" | "ebanista" | null }) {
  const { ti } = useTi();
  const contractors = people.filter((p) => p.kind === "contratista").sort((a, b) => Number(b.role === prefer) - Number(a.role === prefer) || a.name.localeCompare(b.name));
  const employees = people.filter((p) => p.kind === "empleado").sort((a, b) => a.name.localeCompare(b.name));
  const roleLabel = (r: string) => (["pintor", "ebanista", "taller", "administrativo"].includes(r) ? ti(`sch_role_${r}` as InspeccionesKey) : r);
  return (
    <>
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
    </>
  );
}

/** "contratista:uuid" → { kind, id }; "none" → null. */
export function parsePerson(v: string): { kind: "empleado" | "contratista"; id: string } | null {
  const [kind, id] = v.split(":");
  if (!id) return null;
  return { kind: kind === "empleado" ? "empleado" : "contratista", id };
}

/** Quién atiende (o sin asignar todavía) y la nota para ese día, de un área o de varias. */
export function AssignDialog({
  request,
  people,
  onClose,
  onDone,
}: {
  request: AssignRequest | null;
  people: SchedulePerson[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { ti } = useTi();
  const open = request !== null;
  const [person, setPerson] = React.useState(NONE);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!request) return;
    const ids = [...new Set(request.schedules.map((s) => (s.personId ? `${s.personKind}:${s.personId}` : NONE)))];
    setPerson(ids.length === 1 ? ids[0] : NONE);
    const notes = [...new Set(request.schedules.map((s) => s.note ?? ""))];
    setNote(notes.length === 1 ? notes[0] : "");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const name = person === NONE ? ti("sch_no_person") : people.find((p) => `${p.kind}:${p.id}` === person)?.name;

  async function save() {
    if (!request) return;
    const ids = request.schedules.map((s) => s.id);
    setSaving(true);
    const res = await assignSchedulesAction(ids, parsePerson(person));
    const res2 = res.ok && request.withNote ? await setScheduleNoteAction(ids, note.trim() || null) : res;
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    if (!res2.ok) return void toast.error(res2.error);
    toast.success(ti("sch_saved"));
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ti("sch_assign_title")}</DialogTitle>
          <DialogDescription>
            {request?.title} · {ti("sch_assign_hint", { n: request?.schedules.length ?? 0 })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={ti("sch_person")}>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger className="w-full">
                <SelectValue>{name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{ti("sch_no_person")}</SelectItem>
                <PersonOptions people={people} prefer={request?.prefer ?? null} />
              </SelectContent>
            </Select>
          </Field>
          {request?.withNote && (
            <Field label={ti("sch_note")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ti("sch_note_ph")} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ti("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? ti("sch_saving") : ti("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
