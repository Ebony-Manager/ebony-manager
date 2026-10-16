"use client";

import * as React from "react";
import { ChevronDown, Pencil, Plus, SkipForward, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import type { LoanCategory, PayrollLoanInstallment, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cancelLoanAction, deleteLoanAction, reflowLoanInstallmentAction } from "./actions";
import { LoanDialog } from "./loan-dialog";
import { EditInstallmentDialog } from "./edit-installment-dialog";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";

function ordinalOf(p: { year: number; month: number; half: 1 | 2 }): number {
  return p.year * 24 + (p.month - 1) * 2 + (p.half - 1);
}

const NEW_LABEL_KEY: Record<LoanCategory, keyof typeof strings.planilla> = {
  prestamo: "loan_new_prestamo",
  adelanto: "loan_new_adelanto",
  herramienta: "loan_new_herramienta",
  dano: "loan_new_dano",
};

function LoanCard({
  loan,
  categories,
  employeeId,
  onChanged,
}: {
  loan: PayrollLoanWithSchedule;
  categories: LoanCategory[];
  employeeId: string;
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const [busy, setBusy] = React.useState(false);
  const [skippingId, setSkippingId] = React.useState<string | null>(null);
  const [installmentsOpen, setInstallmentsOpen] = React.useState(false);
  const [editingInstallment, setEditingInstallment] = React.useState<PayrollLoanInstallment | null>(null);
  const [editLoanOpen, setEditLoanOpen] = React.useState(false);

  const sorted = [...loan.installments].sort((a, b) => ordinalOf(a.period) - ordinalOf(b.period));
  const paidCount = sorted.filter((i) => i.paid).length;
  const pending = sorted.filter((i) => !i.paid);
  const nextPending = pending[0];
  const last = sorted[sorted.length - 1];
  const isAdelanto = loan.category === "adelanto";
  const isCancelled = loan.status === "cancelled";
  const canCancel = !isCancelled && Boolean(nextPending);
  const canEdit = !isCancelled && paidCount === 0;
  const pendingBalanceCents = pending.reduce((sum, i) => sum + i.amountCents, 0);
  const progress = sorted.length > 0 ? Math.round((paidCount / sorted.length) * 100) : 0;

  const pl = (p: { year: number; month: number; half: 1 | 2 }) =>
    `${monthShort(lang, p.month)} ${p.year} · ${p.half === 1 ? "1ra" : "2da"}`;

  async function run(fn: () => Promise<void>, doneMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(doneMsg);
      onChanged();
    } catch (err) {
      console.error("Planilla: no se pudo completar la acción", err);
      toast.error(err instanceof Error ? err.message : tt("load_failed"));
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!window.confirm(tt("loan_cancel_confirm"))) return;
    void run(() => cancelLoanAction(loan.id), tt("loan_cancelled_done"));
  }

  function handleDelete() {
    if (!window.confirm(`${tt("loan_delete_confirm")}\n\n${formatCents(loan.principalCents)} · ${formatDate(lang, loan.requestDate)}`)) {
      return;
    }
    void run(() => deleteLoanAction(loan.id), tt("loan_deleted"));
  }

  async function handleSkip(inst: PayrollLoanInstallment) {
    setSkippingId(inst.ledgerEntryId);
    try {
      await reflowLoanInstallmentAction({
        loanId: loan.id,
        employeeId: loan.employeeId,
        ledgerEntryId: inst.ledgerEntryId,
        newAmountCents: 0,
      });
      toast.success(tt("loan_installment_skipped"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt("load_failed"));
    } finally {
      setSkippingId(null);
    }
  }

  const label = t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[loan.category] as keyof typeof strings.planilla]);

  return (
    <div className={`rounded-none border border-border p-3 text-xs ${isCancelled ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {label} · {formatCents(loan.principalCents)}
            {isCancelled && <span className="ml-2 font-normal text-muted-foreground">({tt("loan_cancelled")})</span>}
            {!isCancelled && pending.length === 0 && sorted.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">({tt("loan_paid_off")})</span>
            )}
          </p>
          {loan.interestCents > 0 && (
            <p className="mt-0.5 text-muted-foreground">
              {tt("loan_interest_card")}: {formatCents(loan.interestCents)}
              {loan.interestRatePct !== null && loan.interestMode !== "fixed" && (
                <>
                  {" "}
                  ({loan.interestRatePct}%{loan.interestMode === "monthly_pct" ? ` ${tt("loan_interest_per_month")}` : ""})
                </>
              )}{" "}
              · {tt("loan_interest_to_pay")} {formatCents(loan.principalCents + loan.interestCents)}
            </p>
          )}
          <p className="mt-0.5 text-muted-foreground">
            {tt("loan_requested")} {formatDate(lang, loan.requestDate)}
            {loan.paymentMethod === "cuota_variable" && <> · {tt("loan_scheme_variable").split(" (")[0]}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title={tt("loan_edit")}
              aria-label={tt("loan_edit")}
              disabled={busy}
              onClick={() => setEditLoanOpen(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title={tt("loan_cancel_btn")}
              aria-label={tt("loan_cancel_btn")}
              disabled={busy}
              onClick={handleCancel}
            >
              <X className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            title={tt("loan_delete")}
            aria-label={tt("loan_delete")}
            disabled={busy}
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {isAdelanto ? (
        <p className="mt-2 text-muted-foreground">
          {sorted[0]
            ? `${tt("loan_deducted_from")} ${pl(sorted[0].period)} — ${sorted[0].paid ? tt("loan_applied") : tt("loan_pending")}.`
            : "—"}
        </p>
      ) : (
        <div className="mt-2 space-y-1 text-muted-foreground">
          {sorted.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-walnut" style={{ width: `${progress}%` }} />
              </div>
              <span className="tabular-nums">
                {paidCount} {tt("loan_of")} {sorted.length}
              </span>
            </div>
          )}
          {nextPending && !isCancelled && (
            <p>
              {tt("loan_next_installment")} {pl(nextPending.period)} · {formatCents(nextPending.amountCents)}
            </p>
          )}
          {last && !isCancelled && pending.length > 0 && (
            <p>
              {tt("loan_payoff_est")} {pl(last.period)} · {tt("loan_remaining_periods").toLowerCase()} {pending.length}{" "}
              {tt("loan_periods_word")} ({tt("loan_months_approx")} {(pending.length / 2).toFixed(1).replace(".0", "")}{" "}
              {tt("loan_months_word")})
            </p>
          )}
        </div>
      )}
      {!isCancelled && pending.length > 0 && (
        <p className="mt-1 font-medium text-foreground">
          {tt("loan_balance_remaining")}: {formatCents(pendingBalanceCents)}
        </p>
      )}
      {loan.notes && <p className="mt-1 italic text-muted-foreground">{loan.notes}</p>}
      {!isCancelled && !canEdit && paidCount > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">{tt("loan_edit_locked")}</p>
      )}

      {sorted.length > 0 && !isAdelanto && (
        <div className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            className="flex items-center gap-1 font-medium text-foreground hover:text-primary"
            onClick={() => setInstallmentsOpen((v) => !v)}
            aria-expanded={installmentsOpen}
          >
            <ChevronDown className={`size-3 transition-transform ${installmentsOpen ? "" : "-rotate-90"}`} />
            {tt("loan_installments_toggle")}
          </button>
          {installmentsOpen && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {sorted.map((inst) => (
                <li key={inst.ledgerEntryId} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {pl(inst.period)} · {formatCents(inst.amountCents)}
                  </span>
                  {inst.paid ? (
                    <span className="text-[10px] font-medium text-muted-foreground">{tt("loan_installment_paid_badge")}</span>
                  ) : (
                    !isCancelled && (
                      <span className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground hover:text-foreground"
                          title={tt("loan_installment_edit")}
                          onClick={() => setEditingInstallment(inst)}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground hover:text-destructive"
                          title={tt("loan_installment_skip")}
                          disabled={skippingId === inst.ledgerEntryId}
                          onClick={() => handleSkip(inst)}
                        >
                          <SkipForward className="size-3" />
                        </Button>
                      </span>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EditInstallmentDialog
        loanId={loan.id}
        employeeId={loan.employeeId}
        ledgerEntryId={editingInstallment?.ledgerEntryId ?? null}
        pending={pending.map((i) => ({ ledgerEntryId: i.ledgerEntryId, period: i.period, amountCents: i.amountCents }))}
        open={editingInstallment !== null}
        onOpenChange={(next) => !next && setEditingInstallment(null)}
        onSaved={onChanged}
      />
      <LoanDialog
        employeeId={employeeId}
        categories={categories}
        defaultCategory={loan.category}
        editing={loan}
        open={editLoanOpen}
        onOpenChange={setEditLoanOpen}
        onSaved={onChanged}
      />
    </div>
  );
}

/**
 * Panel de una familia de financiamientos: "Préstamos y adelantos" o
 * "Herramientas y daños". Arriba lo vigente (con saldo y tiempo que falta) y
 * abajo, plegable, el historial (cancelados y ya pagados por completo).
 */
export function LoansPanel({
  employeeId,
  categories,
  loans,
  onChanged,
}: {
  employeeId: string;
  categories: LoanCategory[];
  loans: PayrollLoanWithSchedule[] | null;
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const [dialogCategory, setDialogCategory] = React.useState<LoanCategory | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const mine = (loans ?? []).filter((l) => categories.includes(l.category));
  const isDone = (l: PayrollLoanWithSchedule) =>
    l.status === "cancelled" || (l.installments.length > 0 && l.installments.every((i) => i.paid));
  const active = mine.filter((l) => !isDone(l));
  const history = mine.filter(isDone);
  const owedCents = active.reduce(
    (sum, l) => sum + l.installments.filter((i) => !i.paid).reduce((s, i) => s + i.amountCents, 0),
    0
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {tt("loans_balance")}:{" "}
          <span className="font-medium text-foreground">{loans === null ? "…" : formatCents(owedCents)}</span>
        </p>
        <div className="flex gap-2">
          {categories.map((c) => (
            <Button key={c} variant="outline" size="sm" onClick={() => setDialogCategory(c)}>
              <Plus className="size-3.5" />
              {tt(NEW_LABEL_KEY[c])}
            </Button>
          ))}
        </div>
      </div>

      {loans === null ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{tt("loading")}</p>
      ) : mine.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{tt("loans_empty")}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              {tt("loans_active")} ({active.length})
            </h4>
            {active.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tt("loans_none_active")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {active.map((l) => (
                  <LoanCard key={l.id} loan={l} categories={categories} employeeId={employeeId} onChanged={onChanged} />
                ))}
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-border pt-3">
              <button
                type="button"
                className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
              >
                <ChevronDown className={`size-3.5 transition-transform ${historyOpen ? "" : "-rotate-90"}`} />
                {tt("loans_history")} ({history.length})
              </button>
              {historyOpen && (
                <div className="grid grid-cols-1 gap-2">
                  {history.map((l) => (
                    <LoanCard key={l.id} loan={l} categories={categories} employeeId={employeeId} onChanged={onChanged} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <LoanDialog
        employeeId={employeeId}
        categories={categories}
        defaultCategory={dialogCategory ?? categories[0]}
        open={dialogCategory !== null}
        onOpenChange={(next) => !next && setDialogCategory(null)}
        onSaved={onChanged}
      />
    </div>
  );
}
