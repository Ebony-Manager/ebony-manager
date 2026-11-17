"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { InventoryPerson, Tool, ToolCondition, ToolLoan } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { toolName } from "@/lib/almacen/tools";
import { Field } from "../../contratistas/field";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { ICON } from "@/lib/ui/concepts";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { returnToolAction } from "../actions";
import { useTa } from "../shared";
import { holderName } from "./common";

const CONDITIONS: ToolCondition[] = ["bien", "reparacion", "danada", "perdida"];
/** Cada condición usa el ícono y el tono del estado en que queda la herramienta. */
const COND_STATUS = { bien: "tool_disponible", reparacion: "tool_reparacion", danada: "tool_danada", perdida: "tool_perdida" } as const;

/** Devolver: cómo llegó (bien → vuelve al almacén; si no, queda en reparación, dañada o perdida). */
export function ReturnDialog({
  loan,
  tool,
  people,
  onClose,
}: {
  loan: ToolLoan | null;
  tool: Tool | null;
  people: Map<string, InventoryPerson>;
  onClose: () => void;
}) {
  const { ta, lang } = useTa();
  const [condition, setCondition] = React.useState<ToolCondition>("bien");
  const [date, setDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => condition !== "bien" || !!notes.trim(), onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!loan) return;
    setCondition("bien");
    setDate(todayInPanama());
    setNotes("");
  }, [loan]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function submit() {
    if (!loan) return;
    setSaving(true);
    const res = await returnToolAction(loan.id, condition, notes || null, date || null);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("return_saved"));
    onClose();
  }

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ta("return_title")}</DialogTitle>
          {loan && (
            <DialogDescription>
              {tool ? toolName(tool) : "—"} · {holderName(loan, people)} · <span className="whitespace-nowrap">{ta("col_since").toLowerCase()} {formatDateCompact(lang, loan.lentOn)}</span>
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={ta("return_condition")}>
            <SegmentedFilter wrap value={condition} onChange={setCondition} options={CONDITIONS.map((c) => ({ value: c, label: ta(`cond_${c}`), icon: STATUS[COND_STATUS[c]].icon, iconClass: TONE_TEXT[STATUS[COND_STATUS[c]].tone] }))} />
          </Field>
          <Field label={ta("date")} icon={ICON.date}>
            <Input type="date" max={todayInPanama()} min={loan?.lentOn} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={ta("notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
            {ta("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? ta("saving") : ta("give_back")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
