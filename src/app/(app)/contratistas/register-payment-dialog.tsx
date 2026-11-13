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
import { PaymentBreakdown } from "./payment-breakdown";
import {
  contractPayableCents,
  contractSublabel,
  looseCredits,
  paymentPreview,
  sortContracts,
  unallocatedSources,
} from "@/lib/contractors/contracts";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { registerContractorPaymentAction } from "./actions";
import { Field } from "./field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import { EmptyState } from "@/components/shared/page-header";

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
  const { error, validate, clear, reset } = useFormErrors<"amounts">();
  const { requestClose, dialog: discardDialog } = useDiscardGuard(
    () => Object.values(amounts).some((v) => v.trim()) || !!notes.trim(),
    () => onOpenChange(false),
  );

  /* eslint-disable react-hooks/set-state-in-effect -- reinicia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setDate(todayInPanama());
    setAmounts({});
    setNotes("");
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const payable = React.useMemo(
    () => sortContracts(contracts.filter((c) => contractPayableCents(c) > 0)),
    [contracts]
  );
  const loosePending = React.useMemo(
    () => looseCredits(entries, allocations).reduce((s, r) => s + r.remainingCents, 0),
    [entries, allocations]
  );
  const onAccount = React.useMemo(() => unallocatedSources(entries, allocations, date), [entries, allocations, date]);
  const onAccountCents = onAccount.reduce((s, r) => s + r.remainingCents, 0);

  const lines = payable.map((c) => ({ contract: c, pending: contractPayableCents(c), cents: toCents(amounts[c.id] ?? "") }));
  const looseCents = toCents(amounts[LOOSE] ?? "");
  const abonosCents = lines.reduce((s, l) => s + l.cents, 0) + looseCents;
  const preview = paymentPreview(abonosCents, onAccountCents);

  const setAmount = (key: string, value: string) => setAmounts((cur) => ({ ...cur, [key]: value }));
  const fill = (key: string, cents: number) => setAmount(key, (cents / 100).toFixed(2));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const over = lines.some((l) => l.cents < 0 || l.cents > l.pending) || looseCents < 0 || looseCents > loosePending;
    if (!validate([["amounts", over || abonosCents <= 0, over ? tt("pay_err_over") : tt("pay_err_empty")]])) return;
    setSubmitting(true);
    const res = await registerContractorPaymentAction({
      contractorId: contractor.id,
      date,
      lines: lines.filter((l) => l.cents > 0).map((l) => ({ contractId: l.contract.id, amountCents: l.cents })),
      looseCents,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("pay_saved"));
    onOpenChange(false);
    onSaved();
  }

  const nothingToPay = payable.length === 0 && loosePending <= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,44rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tt("pay_title")} · {contractor.name}
          </DialogTitle>
          <DialogDescription>{tt("pay_desc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={tt("mov_f_date")} icon={ICON.date} className="max-w-48">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          {nothingToPay ? (
            <EmptyState>
              {tt("pay_nothing")}
            </EmptyState>
          ) : (
            <FormSection icon={ICON.quote} title={tt("ct_col_contract")} error={error("amounts")}>
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
                      sublabel={contractSublabel(c, tt("ct_retained"))}
                      muted={c.status !== "ACTIVE"}
                      pending={pending}
                      value={amounts[c.id] ?? ""}
                      onChange={(v) => {
                        setAmount(c.id, v);
                        clear("amounts");
                      }}
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
                      onChange={(v) => {
                        setAmount(LOOSE, v);
                        clear("amounts");
                      }}
                      onFill={() => fill(LOOSE, loosePending)}
                      fillLabel={tt("pay_fill")}
                    />
                  )}
                </tbody>
              </table>
            </div>
            </FormSection>
          )}

          <PaymentBreakdown
            abonos={[
              ...lines.map(({ contract: k, cents }) => ({
                label: k.projectName !== k.name ? `${k.name} (${k.projectName})` : k.name,
                cents,
              })),
              { label: tt("pay_loose"), cents: looseCents },
            ]}
            pending={onAccount}
            deductedCents={preview.deductedCents}
            cashCents={preview.cashCents}
          />

          <Field label={tt("mov_f_notes")}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting || nothingToPay}>
              {submitting ? tt("saving") : tt("pay_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
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
