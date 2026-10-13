"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollLedgerEntry } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { deleteLedgerEntryAction } from "./actions";
import { LedgerEntryDialog, type LedgerPeriodOption } from "./ledger-entry-dialog";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";

/** Movimientos sueltos del ledger (herramientas/daños anotados a mano, seguro
 *  social, carnet, otros): los que NO vienen de un préstamo a cuotas ni de
 *  InDrive, que tienen sus propias pestañas. */
export function OtherMovementsPanel({
  employeeId,
  entries,
  periodOptions,
  onChanged,
}: {
  employeeId: string;
  entries: PayrollLedgerEntry[] | null;
  periodOptions: LedgerPeriodOption[];
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());

  const generic = (entries ?? []).filter(
    (e) => !e.loanId && e.category !== "prestamo" && e.category !== "adelanto" && e.category !== "indrive" && !hiddenIds.has(e.id)
  );

  const periodLabelForEntry = (payrollEntryId: string | null) => {
    const p = payrollEntryId ? periodOptions.find((o) => o.payrollEntryId === payrollEntryId) : null;
    return p ? `${monthShort(lang, p.month)} ${p.year} · ${p.half === 1 ? "1ra" : "2da"}` : "—";
  };

  async function handleDelete(id: string) {
    setHiddenIds((prev) => new Set(prev).add(id));
    try {
      await deleteLedgerEntryAction(id);
      onChanged();
    } catch (err) {
      console.error("Planilla: no se pudo borrar el movimiento", err);
      toast.error(tt("load_failed"));
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">{tt("other_mov_title")}</h4>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tt("movimiento_add")}
        </Button>
      </div>

      {generic.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{tt("movimientos_empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1.5 font-medium">{tt("mov_col_date")}</th>
                <th className="py-1.5 font-medium">{tt("mov_col_category")}</th>
                <th className="py-1.5 font-medium">{tt("mov_col_period")}</th>
                <th className="py-1.5 text-right font-medium">{tt("mov_col_amount")}</th>
                <th className="py-1.5 font-medium">{tt("mov_col_notes")}</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {generic.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 text-foreground">{formatDate(lang, e.entryDate)}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[e.category] as keyof typeof strings.planilla])}
                  </td>
                  <td className="py-1.5 text-muted-foreground">{periodLabelForEntry(e.payrollEntryId)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${e.direction === "debt" ? "text-destructive" : "text-foreground"}`}>
                    {e.direction === "debt" ? "+" : "-"}
                    {formatCents(e.amountCents)}
                  </td>
                  <td className="max-w-40 truncate py-1.5 text-muted-foreground" title={e.notes ?? undefined}>
                    {e.notes ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      title={tt("mov_delete_title")}
                      onClick={() => handleDelete(e.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LedgerEntryDialog
        employeeId={employeeId}
        periodOptions={periodOptions}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={onChanged}
      />
    </div>
  );
}
