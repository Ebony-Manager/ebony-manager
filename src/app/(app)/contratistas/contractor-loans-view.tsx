"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, HandCoins, Hourglass, ListChecks, Trash2 } from "lucide-react";

import type { ContractorLedgerCategory } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { computeContractorsDashboard } from "@/lib/contractors/dashboard";
import { formatCents, currentPeriod } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { contractorProfilePath } from "@/lib/personal/paths";
import { PayrollKpiCard } from "../planilla/payroll-kpi-card";
import { ContractorAvatar } from "./contractor-avatar";
import type { ContractorsDashboardInput } from "./contractors-dashboard-view";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { cancelContractorLoanAction, deleteContractorLoanAction, type ContractorLoanResult } from "./actions";
import type { ChargeTypeFilter } from "../planilla/employee-charges-tab";

const CHARGE_CATEGORIES = new Set<string>(["prestamo", "adelanto", "herramienta", "dano", "indrive"]);

/** Una fila: un préstamo en cuotas, o un movimiento suelto (una sola vez). */
interface Row {
  key: string;
  loanId: string | null;
  contractorId: string;
  category: ContractorLedgerCategory;
  date: string;
  totalCents: number;
  interestCents: number;
  count: number;
  dueCount: number;
  dueCents: number;
  pendingCents: number;
  next: { date: string; amountCents: number } | null;
  cancelled: boolean;
}

/**
 * Personal → Pagos → Préstamos y descuentos, parte de contratistas: los
 * préstamos, adelantos, herramientas, daños e InDrive (filtrados por el tipo
 * elegido arriba). Igual que a empleados, pueden ir en cuotas: cada cuota
 * baja el saldo al empezar su quincena. También salen los movimientos
 * sueltos del estado de cuenta (lo registrado antes de las cuotas). Por
 * defecto solo el año en curso y lo que aún tiene cuotas pendientes.
 */
export function ContractorLoansView({ input, typeFilter }: { input: ContractorsDashboardInput; typeFilter: ChargeTypeFilter }) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const tc = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();
  const year = currentPeriod().year;
  const [showAll, setShowAll] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const { byId, balances } = React.useMemo(() => {
    const summary = computeContractorsDashboard(input.contractors, input.entries, new Map(input.projectNames), "all");
    return {
      byId: new Map(input.contractors.map((c) => [c.id, c])),
      balances: new Map(summary.contractors.map((c) => [c.contractor.id, c.balanceCents])),
    };
  }, [input]);

  const rows: Row[] = React.useMemo(
    () =>
      [
        ...(input.loans ?? []).map((l) => ({
          key: l.id,
          loanId: l.id,
          contractorId: l.contractorId,
          category: l.category,
          date: l.requestDate,
          totalCents: l.principalCents + l.interestCents,
          interestCents: l.interestCents,
          count: l.installmentCount,
          dueCount: l.dueCount,
          dueCents: l.dueCents,
          pendingCents: l.pendingCents,
          next: l.next,
          cancelled: l.status === "cancelled",
        })),
        ...input.entries
          .filter((e) => !e.loanId && CHARGE_CATEGORIES.has(e.category) && e.direction === "reduce")
          .map((e, i) => ({
            key: `e-${e.contractorId}-${e.entryDate}-${i}`,
            loanId: null,
            contractorId: e.contractorId,
            category: e.category,
            date: e.entryDate,
            totalCents: e.amountCents,
            interestCents: 0,
            count: 1,
            dueCount: 1,
            dueCents: e.amountCents,
            pendingCents: 0,
            next: null,
            cancelled: false,
          })),
      ]
        .filter((r) => typeFilter === "all" || r.category === typeFilter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [input, typeFilter]
  );

  const thisYear = rows.filter((r) => r.date.startsWith(`${year}-`));
  const shown = showAll ? rows : rows.filter((r) => r.date.startsWith(`${year}-`) || r.pendingCents > 0);
  const pending = rows.filter((r) => !r.cancelled).reduce((s, r) => s + r.pendingCents, 0);
  const owing = [...balances.values()].filter((b) => b < 0);
  const th = "px-3 py-2 font-medium whitespace-nowrap";

  async function run(id: string, action: () => Promise<ContractorLoanResult>, done: string) {
    setBusy(id);
    const res = await action();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(done);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{tg("cl_hint")}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PayrollKpiCard
          icon={HandCoins}
          label={`${tg("cl_kpi_total")} ${year}`}
          value={formatCents(thisYear.reduce((s, r) => s + r.totalCents, 0))}
        />
        <PayrollKpiCard icon={ListChecks} label={`${tg("cl_kpi_count")} ${year}`} value={String(thisYear.length)} />
        <PayrollKpiCard icon={Hourglass} label={tg("cl_kpi_pending")} value={formatCents(pending)} sublabel={tg("cl_kpi_pending_sub")} />
        <PayrollKpiCard
          icon={Hourglass}
          label={tg("cl_kpi_owing")}
          value={formatCents(owing.reduce((s, b) => s - b, 0))}
          sublabel={`${owing.length} ${tg("cl_kpi_owing_sub")}`}
        />
      </div>

      <label className="flex cursor-pointer items-center justify-end gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        {tg("cl_show_all")}
      </label>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tg("cl_empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className={th}>{tg("cl_col_contractor")}</th>
                <th className={th}>{tg("cl_col_type")}</th>
                <th className={`${th} text-right`}>{tg("cl_col_amount")}</th>
                <th className={th}>{tp("lo_col_progress")}</th>
                <th className={`${th} text-right`}>{tg("cl_col_pending")}</th>
                <th className={th}>{tp("lo_col_next")}</th>
                <th className={`${th} text-right`}>{tg("cl_col_balance")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const c = byId.get(r.contractorId);
                const balance = balances.get(r.contractorId) ?? 0;
                const done = r.cancelled || r.pendingCents === 0;
                const pct = r.count > 0 ? Math.round((r.dueCount / r.count) * 100) : 0;
                return (
                  <tr key={r.key} className={`border-b border-border last:border-0 ${done ? "text-muted-foreground" : ""}`}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <ContractorAvatar name={c?.name ?? "—"} />
                        <Link
                          href={contractorProfilePath(r.contractorId, "prestamos")}
                          className="font-medium text-foreground hover:underline"
                        >
                          {c?.name ?? "—"}
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {tc(CONTRACTOR_CATEGORY_LABEL_KEY[r.category] as keyof typeof strings.contratistas)}
                      <span className="ml-1 text-xs text-muted-foreground">· {formatDate(lang, r.date)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCents(r.totalCents - r.interestCents)}
                      {r.interestCents > 0 && (
                        <span className="block text-[11px] text-muted-foreground">
                          + {formatCents(r.interestCents)} {tp("lo_interest_short")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-walnut" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="whitespace-nowrap text-xs tabular-nums">
                          {r.dueCount} {tp("loan_of")} {r.count}
                        </span>
                        {r.cancelled && <span className="text-xs">({tp("lo_cancelled")})</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{formatCents(r.pendingCents)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {r.next ? `${formatDate(lang, r.next.date)} · ${formatCents(r.next.amountCents)}` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${balance < 0 ? "text-destructive" : "text-foreground"}`}>
                      {formatCents(balance)}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {r.loanId && !r.cancelled && r.pendingCents > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground"
                          title={tg("cl_cancel")}
                          disabled={busy === r.loanId}
                          onClick={() => {
                            if (!r.loanId || !window.confirm(tg("cl_cancel_confirm"))) return;
                            const id = r.loanId;
                            void run(id, () => cancelContractorLoanAction(id), tg("cl_cancelled"));
                          }}
                        >
                          <Ban className="size-3.5" />
                        </Button>
                      )}
                      {r.loanId && r.dueCount === 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title={tg("cl_delete")}
                          disabled={busy === r.loanId}
                          onClick={() => {
                            if (!r.loanId || !window.confirm(tg("cl_delete_confirm"))) return;
                            const id = r.loanId;
                            void run(id, () => deleteContractorLoanAction(id), tg("cl_deleted"));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
