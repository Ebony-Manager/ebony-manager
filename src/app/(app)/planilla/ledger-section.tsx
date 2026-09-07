"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";

import type { PayrollLedgerEntry, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  getLedgerEntriesAction,
  getLedgerBalanceAction,
  deleteLedgerEntryAction,
  getLoansAction,
  cancelLoanAction,
} from "./actions";
import { LedgerEntryDialog, type LedgerPeriodOption } from "./ledger-entry-dialog";
import { LoanDialog } from "./loan-dialog";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";

function ordinalOf(p: { year: number; month: number; half: 1 | 2 }): number {
  return p.year * 24 + (p.month - 1) * 2 + (p.half - 1);
}

function LoanCard({
  loan,
  onCancelled,
}: {
  loan: PayrollLoanWithSchedule;
  onCancelled: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const [cancelling, setCancelling] = React.useState(false);

  const sorted = [...loan.installments].sort((a, b) => ordinalOf(a.period) - ordinalOf(b.period));
  const paidCount = sorted.filter((i) => i.paid).length;
  const nextPending = sorted.find((i) => !i.paid);
  const last = sorted[sorted.length - 1];
  const isAdelanto = loan.category === "adelanto";
  const canCancel = loan.status === "active" && Boolean(nextPending);

  const pl = (p: { year: number; month: number; half: 1 | 2 }) =>
    `${monthShort(lang, p.month)} ${p.year} · ${p.half === 1 ? "1ra" : "2da"}`;

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelLoanAction(loan.id);
      onCancelled();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-md border border-border p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[loan.category] as keyof typeof strings.planilla])} ·{" "}
            {formatCents(loan.principalCents)}
            {loan.status === "cancelled" && <span className="ml-2 text-muted-foreground">({tt("loan_cancelled")})</span>}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {tt("loan_requested")} {formatDate(lang, loan.requestDate)}
          </p>
        </div>
        {canCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            title={tt("loan_cancel_title")}
            disabled={cancelling}
            onClick={handleCancel}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      {isAdelanto ? (
        <p className="mt-2 text-muted-foreground">
          {sorted[0]
            ? `${tt("loan_deducted_from")} ${pl(sorted[0].period)} — ${sorted[0].paid ? tt("loan_applied") : tt("loan_pending")}.`
            : "—"}
        </p>
      ) : (
        <div className="mt-2 space-y-1 text-muted-foreground">
          <p>
            {paidCount} {tt("loan_of")} {sorted.length} {tt("loan_installments_paid")} · {formatCents(sorted[0]?.amountCents ?? 0)}
          </p>
          {nextPending && (
            <p>
              {tt("loan_next_installment")} {pl(nextPending.period)} · {formatCents(nextPending.amountCents)}
            </p>
          )}
          {last && (
            <p>
              {tt("loan_payoff_est")} {pl(last.period)}
            </p>
          )}
        </div>
      )}
      {loan.notes && <p className="mt-1 italic text-muted-foreground">{loan.notes}</p>}
    </div>
  );
}

/** Préstamos/Adelantos (calendario auto-aplicado) + Herramientas/Daños/
 *  Otros (ledger genérico). Portado de Atlas. */
export function LedgerSection({
  employeeId,
  periodOptions,
  onChanged,
}: {
  employeeId: string;
  periodOptions: LedgerPeriodOption[];
  onChanged?: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [entries, setEntries] = React.useState<PayrollLedgerEntry[] | null>(null);
  const [loans, setLoans] = React.useState<PayrollLoanWithSchedule[] | null>(null);
  const [balanceCents, setBalanceCents] = React.useState<number | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [loanDialog, setLoanDialog] = React.useState<"prestamo" | "adelanto" | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    getLedgerEntriesAction(employeeId).then(setEntries);
    getLoansAction(employeeId).then(setLoans);
    getLedgerBalanceAction(employeeId).then(setBalanceCents);
    onChanged?.();
  }, [employeeId, onChanged]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteLedgerEntryAction(id);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  const periodLabelForEntry = (payrollEntryId: string | null) => {
    if (!payrollEntryId) return "—";
    const p = periodOptions.find((o) => o.payrollEntryId === payrollEntryId);
    if (!p) return "—";
    return `${monthShort(lang, p.month)} ${p.year} · ${p.half === 1 ? "1ra" : "2da"}`;
  };

  const genericEntries = (entries ?? []).filter((e) => e.category !== "prestamo" && e.category !== "adelanto");

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">{tt("loans_title")}</h3>
          <p className="text-xs text-muted-foreground">
            {tt("loans_balance")}: {balanceCents === null ? "…" : formatCents(balanceCents)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLoanDialog("prestamo")}>
            <Plus className="size-3.5" />
            {tt("loan_new_prestamo")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLoanDialog("adelanto")}>
            <Plus className="size-3.5" />
            {tt("loan_new_adelanto")}
          </Button>
        </div>
      </div>

      {loans !== null && loans.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">{tt("loans_empty")}</p>
      )}
      {loans !== null && loans.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} onCancelled={load} />
          ))}
        </div>
      )}

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{tt("movimientos_title")}</h3>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tt("movimiento_add")}
        </Button>
      </div>

      {genericEntries.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">{tt("movimientos_empty")}</p>
      )}

      {genericEntries.length > 0 && (
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
              {genericEntries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 text-foreground">{formatDate(lang, e.entryDate)}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[e.category] as keyof typeof strings.planilla])}
                  </td>
                  <td className="py-1.5 text-muted-foreground">{periodLabelForEntry(e.payrollEntryId)}</td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${e.direction === "debt" ? "text-destructive" : "text-foreground"}`}
                  >
                    {e.direction === "debt" ? "+" : "-"}
                    {formatCents(e.amountCents)}
                  </td>
                  <td className="max-w-48 truncate py-1.5 text-muted-foreground" title={e.notes ?? undefined}>
                    {e.notes ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      title={tt("mov_delete_title")}
                      disabled={deletingId === e.id}
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
        onSaved={load}
      />
      <LoanDialog
        employeeId={employeeId}
        defaultCategory={loanDialog ?? "prestamo"}
        open={loanDialog !== null}
        onOpenChange={(next) => setLoanDialog(next ? loanDialog : null)}
        onSaved={load}
      />
    </div>
  );
}
