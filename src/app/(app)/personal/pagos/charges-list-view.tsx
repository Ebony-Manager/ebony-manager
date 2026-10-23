"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, CheckCircle2, HandCoins, Hourglass, ListChecks, Percent, Trash2 } from "lucide-react";

import type { LoanOverviewRow, PayrollEmployee } from "@/types/planilla";
import type { ContractorLedgerCategory } from "@/types/contractors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, shortPeriodLabel } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { contractorProfilePath } from "@/lib/personal/paths";
import { getLoansOverviewAction } from "../../planilla/actions";
import { EmployeeAvatar } from "../../planilla/employee-avatar";
import { PayrollKpiCard } from "../../planilla/payroll-kpi-card";
import { LEDGER_CATEGORY_LABEL_KEY } from "../../planilla/ledger-labels";
import type { ChargeTypeFilter } from "../../planilla/employee-charges-tab";
import { ContractorAvatar } from "../../contratistas/contractor-avatar";
import type { ContractorsDashboardInput } from "../../contratistas/contractors-dashboard-view";
import {
  cancelContractorLoanAction,
  deleteContractorLoanAction,
  type ContractorLoanResult,
} from "../../contratistas/actions";

const CHARGE_CATEGORIES = new Set<string>(["prestamo", "adelanto", "herramienta", "dano", "indrive", "otro", "tercero"]);

/** Una fila de la lista: de un empleado o de un contratista, con el mismo formato. */
interface ChargeRow {
  key: string;
  kind: "employee" | "contractor";
  personId: string;
  personName: string;
  sortOrder: number;
  /** Préstamo de contratista en cuotas (para cancelar/borrar); null en los demás. */
  contractorLoanId: string | null;
  /** "tercero" solo existe para empleados. */
  category: ContractorLedgerCategory | "tercero";
  date: string;
  principalCents: number;
  interestCents: number;
  count: number;
  paidCount: number;
  paidCents: number;
  pendingCents: number;
  next: { label: string; amountCents: number } | null;
  cancelled: boolean;
  done: boolean;
}

/**
 * Personal → Pagos → Préstamos y descuentos: UNA sola lista para empleados y
 * contratistas — préstamos, adelantos, herramientas, daños e InDrive, con su
 * avance ("1 de 3"), lo cobrado, lo que falta y la próxima cuota. A un
 * empleado la cuota se le descuenta en la planilla; a un contratista, en su
 * estado de cuenta (al empezar la quincena). Por defecto, lo vigente; el
 * historial (pagados, cancelados y los movimientos sueltos de contratistas)
 * se abre con un interruptor.
 */
export function ChargesListView({
  employees,
  contractors,
  showEmployees,
  showContractors,
  typeFilter,
  reloadSignal,
  onOpenEmployee,
}: {
  /** Empleados que deja pasar el filtro Taller / Administrativo. */
  employees: PayrollEmployee[];
  contractors: ContractorsDashboardInput | null;
  showEmployees: boolean;
  showContractors: boolean;
  typeFilter: ChargeTypeFilter;
  reloadSignal: number;
  onOpenEmployee: (employeeId: string) => void;
}) {
  const { lang } = useLang();
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const ts = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const router = useRouter();

  const [employeeLoans, setEmployeeLoans] = React.useState<LoanOverviewRow[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!showEmployees) return;
    getLoansOverviewAction()
      .then((r) => {
        setEmployeeLoans(r);
        setFailed(false);
      })
      .catch((err) => {
        console.error("Pagos: no se pudieron cargar los préstamos", err);
        setFailed(true);
      });
  }, [showEmployees]);

  React.useEffect(() => {
    load();
  }, [load, reloadSignal]);

  const rows = React.useMemo<ChargeRow[]>(() => {
    const out: ChargeRow[] = [];
    if (showEmployees) {
      const byId = new Map(employees.map((e) => [e.id, e]));
      for (const r of employeeLoans ?? []) {
        const emp = byId.get(r.employeeId);
        if (!emp) continue;
        out.push({
          key: `e-${r.loanId}`,
          kind: "employee",
          personId: emp.id,
          personName: emp.name,
          sortOrder: emp.sortOrder,
          contractorLoanId: null,
          category: r.category,
          date: r.requestDate,
          principalCents: r.principalCents,
          interestCents: r.interestCents,
          count: r.installmentCount,
          paidCount: r.paidCount,
          paidCents: r.paidCents,
          pendingCents: r.pendingCents,
          next: r.next ? { label: shortPeriodLabel(lang, r.next.period), amountCents: r.next.amountCents } : null,
          cancelled: r.status === "cancelled",
          done: r.status === "cancelled" || (r.installmentCount > 0 && r.pendingCents === 0),
        });
      }
    }
    if (showContractors && contractors) {
      const names = new Map(contractors.contractors.map((c) => [c.id, c.name]));
      for (const l of contractors.loans ?? []) {
        out.push({
          key: `c-${l.id}`,
          kind: "contractor",
          personId: l.contractorId,
          personName: names.get(l.contractorId) ?? "—",
          sortOrder: 0,
          contractorLoanId: l.id,
          category: l.category,
          date: l.requestDate,
          principalCents: l.principalCents,
          interestCents: l.interestCents,
          count: l.installmentCount,
          paidCount: l.dueCount,
          paidCents: l.dueCents,
          pendingCents: l.pendingCents,
          next: l.next ? { label: formatDate(lang, l.next.date), amountCents: l.next.amountCents } : null,
          cancelled: l.status === "cancelled",
          done: l.status === "cancelled" || l.pendingCents === 0,
        });
      }
      // Movimientos sueltos del estado de cuenta (lo registrado sin cuotas): ya descontados.
      contractors.entries
        .filter((e) => !e.loanId && CHARGE_CATEGORIES.has(e.category) && e.direction === "reduce")
        .forEach((e, i) =>
          out.push({
            key: `m-${e.contractorId}-${e.entryDate}-${i}`,
            kind: "contractor",
            personId: e.contractorId,
            personName: names.get(e.contractorId) ?? "—",
            sortOrder: 0,
            contractorLoanId: null,
            category: e.category,
            date: e.entryDate,
            principalCents: e.amountCents,
            interestCents: 0,
            count: 1,
            paidCount: 1,
            paidCents: e.amountCents,
            pendingCents: 0,
            next: null,
            cancelled: false,
            done: true,
          })
        );
    }
    return out.filter((r) => typeFilter === "all" || r.category === typeFilter);
  }, [employees, employeeLoans, contractors, showEmployees, showContractors, typeFilter, lang]);

  const active = rows.filter((r) => !r.done);
  // Los descuentos a terceros (ej. una financiera) no son dinero de Ebony: fuera de prestado / cobrado / por cobrar.
  const own = active.filter((r) => r.category !== "tercero");
  const kpiLent = own.reduce((s, r) => s + r.principalCents, 0);
  const kpiPending = own.reduce((s, r) => s + r.pendingCents, 0);
  const kpiCollected = own.reduce((s, r) => s + r.paidCents, 0);
  const thirdPartyPending = active.filter((r) => r.category === "tercero").reduce((s, r) => s + r.pendingCents, 0);
  // Intereses: lo pactado en lo no cancelado y la parte ya cobrada (proporcional a lo pagado).
  const interestAgreed = rows.filter((r) => !r.cancelled).reduce((s, r) => s + r.interestCents, 0);
  const interestCollected = rows.reduce((s, r) => {
    const total = r.principalCents + r.interestCents;
    return s + (r.interestCents > 0 && total > 0 ? Math.round(r.interestCents * Math.min(r.paidCents / total, 1)) : 0);
  }, 0);

  const shown = rows
    .filter((r) => history || !r.done)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.date.localeCompare(a.date) || a.personName.localeCompare(b.personName));

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

  const open = (r: ChargeRow) =>
    r.kind === "employee" ? onOpenEmployee(r.personId) : router.push(contractorProfilePath(r.personId, "prestamos"));
  const th = "px-3 py-2 font-medium whitespace-nowrap";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PayrollKpiCard icon={HandCoins} label={tp("lo_kpi_lent")} value={formatCents(kpiLent)} />
        <PayrollKpiCard icon={CheckCircle2} label={tp("lo_kpi_collected")} value={formatCents(kpiCollected)} />
        <PayrollKpiCard
          icon={Hourglass}
          label={tp("lo_kpi_pending")}
          value={formatCents(kpiPending)}
          sublabel={thirdPartyPending > 0 ? `${tp("lo_kpi_third_party")} ${formatCents(thirdPartyPending)}` : undefined}
        />
        <PayrollKpiCard icon={ListChecks} label={tp("lo_kpi_count")} value={String(active.length)} />
        <PayrollKpiCard
          icon={Percent}
          label={tp("lo_kpi_interest")}
          value={formatCents(interestCollected)}
          sublabel={`${tp("lo_kpi_interest_of")} ${formatCents(interestAgreed)}`}
        />
      </div>

      <label className="flex cursor-pointer items-center justify-end gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
        {tp("lo_show_history")}
      </label>

      {failed ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>{tp("load_failed")}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={load}>
            {tp("retry")}
          </Button>
        </div>
      ) : showEmployees && employeeLoans === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tp("loading")}</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tp("lo_empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className={th}>{ts("col_person")}</th>
                <th className={th}>{tp("lo_col_type")}</th>
                <th className={`${th} text-right`}>{tp("lo_col_amount")}</th>
                <th className={th}>{tp("lo_col_progress")}</th>
                <th className={`${th} text-right`}>{tp("lo_col_paid")}</th>
                <th className={`${th} text-right`}>{tp("lo_col_pending")}</th>
                <th className={th}>{tp("lo_col_next")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const pct = r.count > 0 ? Math.round((r.paidCount / r.count) * 100) : 0;
                const label = t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[r.category as keyof typeof LEDGER_CATEGORY_LABEL_KEY] as keyof typeof strings.planilla]);
                return (
                  <tr
                    key={r.key}
                    className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${r.done ? "text-muted-foreground" : ""}`}
                    onClick={() => open(r)}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        {r.kind === "employee" ? (
                          <EmployeeAvatar name={r.personName} employeeId={r.personId} sortOrder={r.sortOrder} size="sm" />
                        ) : (
                          <ContractorAvatar name={r.personName} />
                        )}
                        <span className="font-medium text-foreground">{r.personName}</span>
                        <Badge variant={r.kind === "employee" ? "secondary" : "outline"} className="text-[10px]">
                          {ts(r.kind === "employee" ? "kind_employee" : "kind_contractor")}
                        </Badge>
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {label}
                      <span className="ml-1 text-xs text-muted-foreground">· {formatDate(lang, r.date)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCents(r.principalCents)}
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
                          {r.paidCount} {tp("loan_of")} {r.count}
                        </span>
                        {r.cancelled && <span className="text-xs">({tp("lo_cancelled")})</span>}
                        {!r.cancelled && r.done && <span className="text-xs">({tp("lo_done")})</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCents(r.paidCents)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                      {formatCents(r.done ? 0 : r.pendingCents)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {!r.done && r.next ? `${r.next.label} · ${formatCents(r.next.amountCents)}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {r.contractorLoanId && !r.cancelled && r.pendingCents > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground"
                          title={tg("cl_cancel")}
                          disabled={busy === r.contractorLoanId}
                          onClick={() => {
                            const id = r.contractorLoanId;
                            if (!id || !window.confirm(tg("cl_cancel_confirm"))) return;
                            void run(id, () => cancelContractorLoanAction(id), tg("cl_cancelled"));
                          }}
                        >
                          <Ban className="size-3.5" />
                        </Button>
                      )}
                      {r.contractorLoanId && r.paidCount === 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title={tg("cl_delete")}
                          disabled={busy === r.contractorLoanId}
                          onClick={() => {
                            const id = r.contractorLoanId;
                            if (!id || !window.confirm(tg("cl_delete_confirm"))) return;
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
            <tfoot>
              <tr className="border-t border-border bg-muted/40 text-xs font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  {tp("lo_total")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(shown.reduce((s, r) => s + r.principalCents, 0))}</td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(shown.reduce((s, r) => s + r.paidCents, 0))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCents(shown.filter((r) => !r.done).reduce((s, r) => s + r.pendingCents, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
