"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { StoredItem, StoredPerson } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { ICON } from "@/lib/ui/concepts";
import { Combo, useTa } from "../shared";
import { deliverStoredItemsAction } from "./actions";

const OTHER = "__other";

/** Entregar algo guardado: a quién (personal, contratista u otra persona escrita), cuándo y una nota. */
export function DeliverDialog({ item, people, onClose }: { item: StoredItem | null; people: StoredPerson[]; onClose: () => void }) {
  const { ta } = useTa();
  const [who, setWho] = React.useState<string | null>(null);
  const [otherName, setOtherName] = React.useState("");
  const [on, setOn] = React.useState(todayInPanama());
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"who">();
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => !!who || !!notes.trim(), onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!item) return;
    setWho(null);
    setOtherName("");
    setOn(todayInPanama());
    setNotes("");
    setSaving(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const options = React.useMemo(
    () => [
      ...people.map((p) => ({ value: `${p.kind}:${p.id}`, label: p.name, hint: p.detail ?? undefined, group: p.kind === "empleado" ? ta("st_group_staff") : ta("st_group_contractors") })),
      { value: OTHER, label: ta("st_deliver_other"), group: " " },
    ],
    [people, ta],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    const person = who && who !== OTHER ? people.find((p) => `${p.kind}:${p.id}` === who) : null;
    const name = person ? person.name : otherName.trim();
    if (!validate([["who", !name, ta("st_deliver_required")]])) return;
    setSaving(true);
    const res = await deliverStoredItemsAction([item.id], {
      deliveredOn: on,
      employeeId: person?.kind === "empleado" ? person.id : null,
      contractorId: person?.kind === "contratista" ? person.id : null,
      name,
      notes,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("st_delivered_saved"));
    onClose();
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ta("st_deliver_title")}</DialogTitle>
          <DialogDescription>
            {item ? `${item.description} · ${item.projectName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Field label={ta("st_deliver_to")} icon={ICON.owner} required error={error("who")}>
            <Combo
              options={options}
              value={who}
              onChange={(v) => {
                setWho(v);
                clear("who");
              }}
              placeholder={ta("st_deliver_pick")}
            />
          </Field>
          {who === OTHER && (
            <Field label={ta("st_deliver_other_name")} required>
              <Input
                autoFocus
                value={otherName}
                onChange={(ev) => {
                  setOtherName(ev.target.value);
                  clear("who");
                }}
                placeholder={ta("st_deliver_other_ph")}
              />
            </Field>
          )}
          <Field label={ta("st_deliver_on")} icon={ICON.date}>
            <Input type="date" value={on} onChange={(ev) => ev.target.value && setOn(ev.target.value)} />
          </Field>
          <Field label={ta("st_f_notes")}>
            <Textarea rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : ta("st_deliver")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
