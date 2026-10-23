"use client";

import type { ContractorContract } from "@/types/contractors";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents, contractProgressPct } from "@/lib/contractors/contracts";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/** Tabla de contratos con su avance. La usan la lista de Contratos y las fichas del contratista y del proyecto. */
export function ContractsTable({
  contracts,
  onOpen,
  showContractor = false,
}: {
  contracts: ContractorContract[];
  onOpen: (c: ContractorContract) => void;
  showContractor?: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">{tt("ct_col_contract")}</th>
            {showContractor && <th className="px-3 py-2 text-left font-medium">{tt("ct_f_contractor")}</th>}
            <th className="px-3 py-2 text-right font-medium">{tt("ct_col_value")}</th>
            <th className="px-3 py-2 text-right font-medium">{tt("ct_col_paid")}</th>
            <th className="px-3 py-2 text-right font-medium">{tt("ct_col_pending")}</th>
            <th className="w-36 px-3 py-2 text-left font-medium">{tt("ct_col_progress")}</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const pending = contractPendingCents(c);
            const pct = contractProgressPct(c);
            const muted = c.status !== "ACTIVE";
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c)}
                className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-3 py-2">
                  <span className={muted ? "text-muted-foreground" : "font-medium text-foreground"}>{c.name}</span>
                  {c.projectName !== c.name && <span className="block text-xs text-muted-foreground">{c.projectName}</span>}
                </td>
                {showContractor && <td className="px-3 py-2 text-muted-foreground">{c.contractorName}</td>}
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatCents(c.valueCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(c.allocatedCents)}</td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${pending < 0 ? "text-destructive" : pending > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                  title={pending < 0 ? tt("ct_overpaid") : undefined}
                >
                  {formatCents(pending)}
                  {c.retentionCents > 0 && pending > 0 && (
                    <span className="block text-[10px] font-normal text-muted-foreground" title={tt("ct_retained_hint")}>
                      {tt("ct_retained")}: {formatCents(Math.min(c.retentionCents, pending))}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
