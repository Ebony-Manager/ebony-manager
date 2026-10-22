"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { ContractorAllocation, ContractorContract, ContractorLedgerEntry } from "@/types/contractors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import {
  contractPendingCents,
  looseCredits,
  paymentPreview,
  sortContracts,
  unallocatedSources,
} from "@/lib/contractors/contracts";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { registerContractorPaymentAction } from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { Field } from "./field";

const LOOSE = "__loose__";

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Registrar un pago a un contratista, repartido entre sus contratos. Lo
 * que está a cuenta (cuotas de préstamo, adelantos, material… con fecha
 * hasta la del pago) se descuenta primero; el resto es el efectivo a
 * entregar. Cada contrato avanza por lo que se le abona.
 */
export function RegisterPaymentDialog({
  contractor,
  contracts,
  entries,
  allocations,
  open,
  onOpenChange,
  onSaved,
}: {
  contractor: { id: string; name: string };
  contracts: ContractorContract[];
  entries: ContractorLedgerEntry[];
  allocations: ContractorAllocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [date, setDate] = React.useState(todayInPanama());
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reinicia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setDate(todayInPanama());
    setAmounts({});
    setNotes("");
    setError(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const payable = React.useMemo(
    () => sortContracts(contracts.filter((c) => contractPendingCents(c) > 0)),
    [contracts]
  );
  const loosePending = React.useMemo(
    () => looseCredits(entries, allocations).reduce((s, r) => s + r.remainingCents, 0),
    [entries, allocations]
  );
  const onAccount = React.useMemo(() => unallocatedSources(entries, allocations, date), [entries, allocations, date]);
  const onAccountCents = onAccount.reduce((s, r) => s + r.remainingCents, 0);

  const lines = payable.map((c) => ({ contract: c, pending: contractPendingCents(c), cents: toCents(amounts[c.id] ?? "") }));
  const looseCents = toCents(amounts[LOOSE] ?? "");
  const abonosCents = lines.reduce((s, l) => s + l.cents, 0) + looseCents;
  const preview = paymentPreview(abonosCents, onAccountCents);
  const leftOnAccount = onAccountCents - preview.deductedCents;

  const setAmount = (key: string, value: string) => setAmounts((cur) => ({ ...cur, [key]: value }));
  const fill = (key: string, cents: number) => setAmount(key, (cents / 100).toFixed(2));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.some((l) => l.cents < 0 || l.cents > l.pending) || looseCents < 0 || looseCents > loosePending) {
      return setError(tt("pay_err_over"));
    }
    if (abonosCents <= 0) return setError(tt("pay_err_empty"));
    setSubmitting(true);
    setError(null);
    const res = await registerContractorPaymentAction({
      contractorId: contractor.id,
      date,
      lines: lines.filter((l) => l.cents > 0).map((l) => ({ contractId: l.contract.id, amountCents: l.cents })),
      looseCents,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    toast.success(tt("pay_saved"));
    onOpenChange(false);
    onSaved();
  }

  const nothingToPay = payable.length === 0 && loosePending <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,44rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tt("pay_title")} · {contractor.name}
          </DialogTitle>
          <DialogDescription>{tt("pay_desc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={tt("mov_f_date")} className="max-w-48">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          {nothingToPay ? (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              {tt("pay_nothing")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">{tt("ct_col_contract")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tt("ct_col_pending")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tt("pay_col_abono")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ contract: c, pending }) => (
                    <PayRow
                      key={c.id}
                      label={c.name}
                      sublabel={c.projectName !== c.name ? c.projectName : undefined}
                      muted={c.status !== "ACTIVE"}
                      pending={pending}
                      value={amounts[c.id] ?? ""}
                      onChange={(v) => setAmount(c.id, v)}
                      onFill={() => fill(c.id, pending)}
                      fillLabel={tt("pay_fill")}
                    />
                  ))}
                  {loosePending > 0 && (
                    <PayRow
                      label={tt("pay_loose")}
                      sublabel={tt("pay_loose_hint")}
                      muted
                      pending={loosePending}
                      value={amounts[LOOSE] ?? ""}
                      onChange={(v) => setAmount(LOOSE, v)}
                      onFill={() => fill(LOOSE, loosePending)}
                      fillLabel={tt("pay_fill")}
                    />
                  )}
                </tbody>
              </table>
            </div>
          )}

          {onAccount.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div>
                <p className="text-xs font-medium text-foreground">{tt("pay_on_account")}</p>
                <p className="text-xs text-muted-foreground">{tt("pay_on_account_hint")}</p>
              </div>
              <ul className="flex max-h-40 flex-col divide-y divide-border overflow-y-auto text-xs">
                {onAccount.map(({ entry, remainingCents }) => (
                  <li key={entry.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-16 shrink-0 text-muted-foreground">{formatDateCompact(lang, entry.entryDate)}</span>
                    <span className="shrink-0 font-medium text-foreground">
                      {t(lang, strings.contratistas[CONTRACTOR_CATEGORY_LABEL_KEY[entry.category] as keyof typeof strings.contratistas])}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.description ?? ""}</span>
                    <span className="shrink-0 tabular-nums text-foreground">{formatCents(remainingCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 text-sm">
            <SummaryRow label={tt("pay_sum_abonos")} value={formatCents(abonosCents)} />
            {onAccountCents > 0 && <SummaryRow label={tt("pay_sum_deducted")} value={`−${formatCents(preview.deductedCents)}`} />}
            <SummaryRow label={tt("pay_sum_cash")} value={formatCents(preview.cashCents)} strong />
            {leftOnAccount > 0 && abonosCents > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                {tt("pay_left_on_account")} {formatCents(leftOnAccount)}
              </p>
            )}
          </div>

          <Field label={tt("mov_f_notes")}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tt("f_optional")} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting || nothingToPay}>
              {submitting ? tt("saving") : tt("pay_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayRow({
  label,
  sublabel,
  muted,
  pending,
  value,
  onChange,
  onFill,
  fillLabel,
}: {
  label: string;
  sublabel?: string;
  muted?: boolean;
  pending: number;
  value: string;
  onChange: (v: string) => void;
  onFill: () => void;
  fillLabel: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <span className={muted ? "text-muted-foreground" : "font-medium text-foreground"}>{label}</span>
        {sublabel && <span className="block text-xs text-muted-foreground">{sublabel}</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(pending)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onFill}>
            {fillLabel}
          </Button>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
            className="h-8 w-28 text-right"
          />
        </div>
      </td>
    </tr>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-semibold text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
