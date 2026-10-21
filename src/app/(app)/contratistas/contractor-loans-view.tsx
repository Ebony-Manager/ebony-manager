"use client";

import * as React from "react";
import Link from "next/link";
import { Banknote, HandCoins, Hourglass } from "lucide-react";

import { computeContractorsDashboard } from "@/lib/contractors/dashboard";
import { formatCents, currentPeriod } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { contractorProfilePath } from "@/lib/personal/paths";
import { PayrollKpiCard } from "../planilla/payroll-kpi-card";
import { ContractorAvatar } from "./contractor-avatar";
import type { ContractorsDashboardInput } from "./contractors-dashboard-view";

const LOAN_CATEGORIES = new Set(["prestamo", "adelanto"]);

/**
 * Personal → Pagos → Préstamos, parte de contratistas: los préstamos y
 * adelantos de su estado de cuenta. No llevan cuotas (se descuentan del
 * saldo), así que en vez de avance se muestra el saldo de hoy de cada uno;
 * negativo = el contratista le debe a Ebony. Por defecto solo el año en
 * curso; "Ver años anteriores" abre todo. El nombre abre su estado de cuenta.
 */
export function ContractorLoansView({ input }: { input: ContractorsDashboardInput }) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const tc = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const year = currentPeriod().year;
  const [showAll, setShowAll] = React.useState(false);

  const { byId, balances } = React.useMemo(() => {
    const summary = computeContractorsDashboard(input.contractors, input.entries, new Map(input.projectNames), "all");
    return {
      byId: new Map(input.contractors.map((c) => [c.id, c])),
      balances: new Map(summary.contractors.map((c) => [c.contractor.id, c.balanceCents])),
    };
  }, [input]);

  const loans = input.entries
    .filter((e) => LOAN_CATEGORIES.has(e.category) && e.direction === "reduce")
    .filter((e) => showAll || e.entryDate.startsWith(`${year}-`))
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  const sum = (category: string) =>
    input.entries
      .filter((e) => e.category === category && e.direction === "reduce" && e.entryDate.startsWith(`${year}-`))
      .reduce((s, e) => s + e.amountCents, 0);
  const owing = [...balances.values()].filter((b) => b < 0);
  const th = "px-3 py-2 font-medium whitespace-nowrap";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{tg("cl_hint")}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <PayrollKpiCard icon={HandCoins} label={`${tg("cl_kpi_loans")} ${year}`} value={formatCents(sum("prestamo"))} />
        <PayrollKpiCard icon={Banknote} label={`${tg("cl_kpi_advances")} ${year}`} value={formatCents(sum("adelanto"))} />
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

      {loans.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tg("cl_empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className={th}>{tg("cl_col_contractor")}</th>
                <th className={th}>{tg("cl_col_type")}</th>
                <th className={th}>{tg("cl_col_date")}</th>
                <th className={`${th} text-right`}>{tg("cl_col_amount")}</th>
                <th className={`${th} text-right`}>{tg("cl_col_balance")}</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((e, i) => {
                const c = byId.get(e.contractorId);
                const balance = balances.get(e.contractorId) ?? 0;
                return (
                  <tr key={`${e.contractorId}-${e.entryDate}-${i}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <ContractorAvatar name={c?.name ?? "—"} />
                        <Link href={contractorProfilePath(e.contractorId, "prestamos")} className="font-medium text-foreground hover:underline">
                          {c?.name ?? "—"}
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{tc(e.category === "prestamo" ? "cat_prestamo" : "cat_adelanto")}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDate(lang, e.entryDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCents(e.amountCents)}</td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${balance < 0 ? "text-destructive" : "text-foreground"}`}>
                      {formatCents(balance)}
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
