"use client";

import type { ContractorLedgerEntry } from "@/types/contractors";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import { isAdvance, type Remaining } from "@/lib/contractors/contracts";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";

type DeductionEntry = Pick<ContractorLedgerEntry, "id" | "entryDate" | "category" | "description" | "loanId">;

/**
 * Cómo sale lo que se le paga a un contratista, en palabras: lo que se
 * abona a sus contratos, lo que se le descuenta (descuentos y adelantos
 * pendientes, de lo más viejo a lo más nuevo) y lo que de verdad se le
 * paga. Lo usan el cierre de quincena y "Registrar pago".
 */
export function PaymentBreakdown({
  abonos,
  pending,
  deductedCents,
  cashCents,
}: {
  /** Lo que se abona, por contrato (o "sin contrato"). */
  abonos: { label: string; cents: number }[];
  /** Lo que está por descontar (fuentes sin repartir hasta la fecha del pago). */
  pending: Remaining<DeductionEntry>[];
  deductedCents: number;
  cashCents: number;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const abonosCents = abonos.reduce((s, a) => s + a.cents, 0);
  const pendingCents = pending.reduce((s, r) => s + r.remainingCents, 0);
  const leftCents = pendingCents - deductedCents;
  const advances = pending.filter((r) => isAdvance(r.entry));
  const deductions = pending.filter((r) => !isAdvance(r.entry));
  const shown = abonos.filter((a) => a.cents > 0);

  const itemLabel = (e: DeductionEntry) =>
    e.category === "pago"
      ? tt("pay_overpaid_label")
      : t(lang, strings.contratistas[CONTRACTOR_CATEGORY_LABEL_KEY[e.category] as keyof typeof strings.contratistas]);

  const group = (title: string, items: Remaining<DeductionEntry>[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <ul className="flex max-h-40 flex-col overflow-y-auto text-xs">
          {items.map(({ entry, remainingCents }) => (
            <li key={entry.id} className="flex items-center gap-3 py-0.5">
              <span className="w-16 shrink-0 text-muted-foreground">{formatDateCompact(lang, entry.entryDate)}</span>
              <span className="shrink-0 text-foreground">{itemLabel(entry)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {entry.category === "pago" ? "" : (entry.description ?? "")}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">{formatCents(remainingCents)}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {pending.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div>
            <p className="text-xs font-medium text-foreground">{tt("pay_on_account")}</p>
            <p className="text-xs text-muted-foreground">{tt("pay_on_account_hint")}</p>
          </div>
          {group(tt("pay_group_deductions"), deductions)}
          {group(tt("pay_group_advances"), advances)}
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">
            {tt("pay_sum_abonos")}
            {shown.length > 0 && (
              <span className="block text-xs">
                {shown.map((a) => `${a.label} ${formatCents(a.cents)}`).join(" · ")}
              </span>
            )}
          </span>
          <span className="tabular-nums text-foreground">{formatCents(abonosCents)}</span>
        </div>
        {pendingCents > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{tt("pay_sum_deducted")}</span>
            <span className="tabular-nums text-foreground">−{formatCents(deductedCents)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
          <span className="font-medium text-foreground">{tt("pay_sum_cash")}</span>
          <span className="font-semibold tabular-nums text-foreground">{formatCents(cashCents)}</span>
        </div>
        {leftCents > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            {tt("pay_left_on_account")} <span className="font-medium tabular-nums text-foreground">{formatCents(leftCents)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
