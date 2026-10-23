"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { computeContractorsDashboard, type ContractorSummary, type DashboardPeriod } from "@/lib/contractors/dashboard";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { contractorProfilePath } from "@/lib/personal/paths";
import { ContractorAvatar } from "./contractor-avatar";
import type { ContractorsDashboardInput } from "./contractors-dashboard-view";

/**
 * Personal → Pagos → Contratistas: cada contratista con lo facturado, lo
 * pagado, lo prestado y su saldo (de toda la historia: positivo = Ebony le
 * debe). Los que más se les debe van arriba. Clic en la fila despliega los
 * proyectos que lleva; el nombre abre su estado de cuenta para registrar
 * el pago.
 */
export function ContractorBalancesView({ input }: { input: ContractorsDashboardInput }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const years = React.useMemo(
    () => [...new Set(input.entries.map((e) => Number(e.entryDate.slice(0, 4))))].sort((a, b) => b - a),
    [input.entries]
  );
  // El saldo es siempre de toda la historia; el período solo cambia las otras columnas.
  const [period, setPeriod] = React.useState<DashboardPeriod>("all");
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  const data = React.useMemo(
    () => computeContractorsDashboard(input.contractors, input.entries, new Map(input.projectNames), period),
    [input, period]
  );
  // Lista de cuentas: solo activos (a nadie se inactiva sin saldar su saldo).
  const tableRows = data.contractors.filter((c) => c.contractor.status === "ACTIVE").sort(
    (a, b) => b.balanceCents - a.balanceCents || b.deliveredCents - a.deliveredCents
  );

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const typeLabel = (c: ContractorSummary) =>
    c.contractor.contractorType === "pintor" ? tt("cd_type_pintor") : tt("cd_type_ebanista");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-1">
        {years.map((y) => (
          <Button key={y} size="sm" variant={period === y ? "secondary" : "ghost"} onClick={() => setPeriod(y)}>
            {y}
          </Button>
        ))}
        <Button size="sm" variant={period === "all" ? "secondary" : "ghost"} onClick={() => setPeriod("all")}>
          {tt("cd_all")}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{tt("cd_table_title")}</p>
          <p className="text-xs text-muted-foreground">{tt("cd_table_hint")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">{tt("cd_col_contractor")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_projects")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_billed")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_paid")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_loans")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_material")}</th>
                <th className="px-2 py-2 text-right font-medium" title={tt("cd_balance_hint")}>
                  {tt("cd_col_balance")}
                </th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_last")}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((c) => {
                const isOpen = open.has(c.contractor.id);
                return (
                  <React.Fragment key={c.contractor.id}>
                    <tr
                      className="cursor-pointer border-b border-border hover:bg-muted/40"
                      onClick={() => toggle(c.contractor.id)}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                          />
                          <ContractorAvatar name={c.contractor.name} />
                          <div className="min-w-0">
                            <Link
                              href={contractorProfilePath(c.contractor.id, "pagos")}
                              onClick={(e) => e.stopPropagation()}
                              className="whitespace-nowrap font-medium text-foreground hover:underline"
                            >
                              {c.contractor.name}
                            </Link>
                            <p className="text-[11px] text-muted-foreground">{typeLabel(c)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.projects.length || "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.billedCents ? formatCents(c.billedCents) : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.paidCents ? formatCents(c.paidCents) : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.loansCents ? formatCents(c.loansCents) : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.materialCents ? formatCents(c.materialCents) : "–"}</td>
                      <td
                        className={`px-2 py-2 text-right font-medium tabular-nums ${c.balanceCents < 0 ? "text-destructive" : "text-foreground"}`}
                      >
                        {formatCents(c.balanceCents)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                        {c.lastEntryDate ? formatDate(lang, c.lastEntryDate) : "–"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border bg-muted/20">
                        <td colSpan={8} className="px-2 py-3 pl-12">
                          {c.projects.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{tt("cd_proj_none")}</p>
                          ) : (
                            <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                              {c.projects.map((p) => (
                                <li key={p.key} className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-foreground">{p.name}</span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {formatCents(p.billedCents)}
                                    {p.days > 0 ? ` · ${p.days} ${tt("cd_proj_days")}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
