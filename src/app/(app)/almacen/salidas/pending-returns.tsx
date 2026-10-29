"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Check, Loader2 } from "lucide-react";

import type { PendingReturn } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { daysBetween } from "@/lib/almacen/tools";
import { getPendingReturnsAction, returnContainersAction, returnToolAction } from "../actions";
import { ItemThumb, qtyWithUnit, useTa } from "../shared";

/** Lo que tiene por devolver la persona elegida ("empleado:id" / "contratista:id"); se recarga al cambiarla. */
export function usePendingReturns(recipient: string | null) {
  const [items, setItems] = React.useState<PendingReturn[]>([]);
  const reload = React.useCallback(() => {
    if (!recipient) return setItems([]);
    const [kind, id] = recipient.split(":") as ["empleado" | "contratista", string];
    void getPendingReturnsAction({ kind, id }).then((res) => setItems(res.ok ? res.data : []));
  }, [recipient]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- trae lo pendiente de la persona elegida.
  React.useEffect(reload, [reload]);
  return { items, setItems, reload };
}

/**
 * Nueva salida → "Tiene por devolver": herramientas prestadas y envases de
 * productos devolvibles de la persona, con «Devuelto» en cada uno (una
 * herramienta devuelta acá vuelve al almacén en buen estado; si llegó dañada,
 * se devuelve desde Herramientas).
 */
export function PendingReturnsList({ items, onReturned }: { items: PendingReturn[]; onReturned: (id: string) => void }) {
  const { ta, lang } = useTa();
  const [busy, setBusy] = React.useState<string | null>(null);
  const today = todayInPanama();
  if (items.length === 0) return null;

  async function giveBack(p: PendingReturn) {
    setBusy(p.id);
    const res = p.kind === "envase" ? await returnContainersAction([p.id]) : await returnToolAction(p.id, "bien", null, null);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(p.kind === "envase" ? ta("container_returned") : ta("return_saved"));
    onReturned(p.id);
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
      <p className="text-xs font-semibold text-warning">
        {ta("pending_title")} ({items.length})
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((p) => {
          const late = p.dueOn ? daysBetween(p.dueOn, today) : 0;
          return (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <ItemThumb path={p.photoPath} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className={`block text-xs ${p.overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {[
                    p.kind === "envase" ? `${ta("pending_container")} · ${qtyWithUnit(p.qty, p.unit, lang)}` : ta("pending_tool"),
                    `${ta("col_since").toLowerCase()} ${formatDateCompact(lang, p.since)}`,
                    p.overdue && late > 0 ? ta("days_late", { n: late }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={busy === p.id} onClick={() => void giveBack(p)}>
                {busy === p.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                {ta("pending_returned")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
