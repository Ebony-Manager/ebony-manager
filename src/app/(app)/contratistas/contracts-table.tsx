"use client";

import type { ContractorContract } from "@/types/contractors";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents, contractProgressPct, contractStage } from "@/lib/contractors/contracts";
import { THUMB_WIDTH, photoUrl } from "@/lib/photo-url";
import { ContractorAvatar } from "./contractor-avatar";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/** Foto (o inicial) del contratista de un contrato. */
function ContractAvatar({ c, size }: { c: ContractorContract; size: "sm" | "md" }) {
  return (
    <ContractorAvatar
      name={c.contractorName}
      photoUrl={c.contractorPhotoPath ? photoUrl("contractor-photos", c.contractorPhotoPath, THUMB_WIDTH) : null}
      size={size}
    />
  );
}

/** La línea de abajo de una fila: la barra de avance, o la etiqueta si ya no hay nada que avanzar. */
function StageLine({ stage, valueCents, pct, tt }: { stage: ReturnType<typeof contractStage>; valueCents: number; pct: number; tt: (k: keyof typeof strings.contratistas) => string }) {
  if (valueCents === 0 && stage !== "completed") return <StatusBadge status="contract_no_value">{tt("ct_no_value")}</StatusBadge>;
  if (stage === "to_close") return <StatusBadge status="contract_to_close">{tt("ct_stage_to_close")}</StatusBadge>;
  if (stage === "completed") return <StatusBadge status="contract_completed">{tt("ct_stage_completed")}</StatusBadge>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

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
    <>
    {/* Celular: una tarjeta por contrato. */}
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:hidden">
      {contracts.map((c) => {
        const pending = contractPendingCents(c);
        const pct = contractProgressPct(c);
        const stage = contractStage(c);
        const muted = stage === "completed";
        return (
          <li key={c.id} onClick={() => onOpen(c)} className="flex cursor-pointer flex-col gap-2 px-3 py-3 active:bg-muted/40">
            <div className="flex items-start gap-3">
              {showContractor && <ContractAvatar c={c} size="md" />}
              <div className="min-w-0 flex-1">
                {showContractor && <p className="truncate text-sm font-semibold text-foreground">{c.contractorName}</p>}
                <p className={`truncate text-sm ${muted ? "text-muted-foreground" : showContractor ? "text-foreground" : "font-medium text-foreground"}`}>{c.name}</p>
                {c.projectName !== c.name && <p className="truncate text-xs text-muted-foreground">{c.projectName}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-muted-foreground">{pending < 0 ? tt("ct_overpaid") : tt("ct_col_pending")}</p>
                <p className={`text-sm tabular-nums ${pending < 0 ? "text-destructive" : pending > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {formatCents(Math.abs(pending))}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {tt("ct_col_value")} {formatCents(c.valueCents)}
                </p>
              </div>
            </div>
            <StageLine stage={stage} valueCents={c.valueCents} pct={pct} tt={tt} />
          </li>
        );
      })}
    </ul>
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
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
            const stage = contractStage(c);
            const muted = stage === "completed";
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
                {showContractor && (
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 text-foreground">
                      <ContractAvatar c={c} size="sm" />
                      {c.contractorName}
                    </span>
                  </td>
                )}
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
                  <StageLine stage={stage} valueCents={c.valueCents} pct={pct} tt={tt} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
