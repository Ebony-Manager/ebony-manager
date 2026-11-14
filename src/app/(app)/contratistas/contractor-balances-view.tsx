"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { computeContractorsDashboard, type ContractorSummary, type DashboardPeriod } from "@/lib/contractors/dashboard";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { contractorProfilePath } from "@/lib/personal/paths";
import { THUMB_WIDTH, photoUrl } from "@/lib/photo-url";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { SearchInput } from "@/components/shared/search-input";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { EmptyState } from "@/components/shared/page-header";
import { ContractorAvatar } from "./contractor-avatar";
import type { ContractorsDashboardInput } from "./contractors-dashboard-view";

type TypeFilter = "all" | "ebanista" | "pintor";

/**
 * Personal → Pagos → Contratistas → Saldos: cada contratista con su saldo de toda la historia (positivo = Ebony
 * le debe; negativo = se le ha entregado de más). Los que más se les debe van arriba. Al abrir una fila, el
 * saldo se explica de punta a punta: lo pendiente de cada contrato, lo acreditado sin contrato, los descuentos
 * y pagos a cuenta, y el saldo. El nombre abre su estado de cuenta.
 */
export function ContractorBalancesView({ input }: { input: ContractorsDashboardInput }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  // Siempre toda la historia (sin filtro de año).
  const period: DashboardPeriod = "all";
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("all");

  const data = React.useMemo(
    () => computeContractorsDashboard(input.contractors, input.entries, new Map(input.projectNames), period),
    [input, period]
  );
  // Lista de cuentas: solo los contratistas activos (los inactivos no se muestran acá; su estado de cuenta
  // sigue en su ficha).
  const tableRows = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return data.contractors
      .filter((c) => c.contractor.status === "ACTIVE")
      .filter((c) => type === "all" || c.contractor.contractorType === type)
      .filter((c) => !q || matchesSearch(c.contractor.name, q))
      .sort((a, b) => b.balanceCents - a.balanceCents || b.deliveredCents - a.deliveredCents);
  }, [data, query, type]);
  const totalBalance = tableRows.reduce((s, c) => s + c.balanceCents, 0);

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder={tt("cd_search_ph")} className="min-w-0 flex-1 sm:max-w-xs" />
        <SegmentedFilter
          fill
          value={type}
          onChange={setType}
          options={[
            { value: "all" as const, label: tt("cd_filter_all") },
            { value: "ebanista" as const, label: tt("cd_type_ebanista") },
            { value: "pintor" as const, label: tt("cd_type_pintor") },
          ]}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {tt("cd_total_balance")}{" "}
        <span className={`font-medium ${totalBalance < 0 ? "text-destructive" : "text-foreground"}`}>{formatCents(totalBalance)}</span> · {tableRows.length}{" "}
        {tt("cl_summary_people")}
      </p>

      {tableRows.length === 0 ? (
        <EmptyState>{tt("no_results")}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-sm sm:min-w-[820px]">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{tt("cd_col_contractor")}</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{tt("cd_col_projects")}</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{tt("cd_col_billed")}</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{tt("cd_col_paid")}</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{tt("cd_col_loans")}</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{tt("cd_col_material")}</th>
                <th className="px-3 py-2 text-right font-medium" title={tt("cd_balance_hint")}>
                  {tt("cd_col_balance")}
                </th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{tt("cd_col_last")}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((c) => {
                const isOpen = open.has(c.contractor.id);
                return (
                  <React.Fragment key={c.contractor.id}>
                    <tr className="cursor-pointer border-b border-border hover:bg-muted/40" onClick={() => toggle(c.contractor.id)}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                          <ContractorAvatar
                            name={c.contractor.name}
                            photoUrl={c.contractor.photoPath ? photoUrl("contractor-photos", c.contractor.photoPath, THUMB_WIDTH) : null}
                            size="md"
                          />
                          <div className="min-w-0">
                            <Link
                              prefetch={false}
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
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{c.projects.length || "–"}</td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{c.billedCents ? formatCents(c.billedCents) : "–"}</td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{c.paidCents ? formatCents(c.paidCents) : "–"}</td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{c.loansCents ? formatCents(c.loansCents) : "–"}</td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{c.materialCents ? formatCents(c.materialCents) : "–"}</td>
                      <td className={`px-3 py-2 text-right font-medium tabular-nums ${c.balanceCents < 0 ? "text-destructive" : "text-foreground"}`}>
                        {formatCents(c.balanceCents)}
                      </td>
                      <td className="hidden px-2 py-2 text-right text-xs text-muted-foreground sm:table-cell">
                        {c.lastEntryDate ? formatDate(lang, c.lastEntryDate) : "–"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border bg-muted/20">
                        <td colSpan={8} className="px-3 py-3 sm:pl-12">
                          <BalanceBreakdown
                            balanceCents={c.balanceCents}
                            lines={(input.pending ?? []).filter((p) => p.contractorId === c.contractor.id).sort((x, y) => y.pendingCents - x.pendingCents)}
                            offsets={input.offsets?.find((o) => o.contractorId === c.contractor.id) ?? null}
                            tt={tt}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Cómo se llega al saldo: lo pendiente de cada contrato (contrato arriba, proyecto debajo) + lo acreditado sin
 * contrato − los descuentos y pagos a cuenta (+ lo que quede sin explicar, para que siempre cuadre) = saldo.
 */
function BalanceBreakdown({
  balanceCents,
  lines,
  offsets,
  tt,
}: {
  balanceCents: number;
  lines: NonNullable<ContractorsDashboardInput["pending"]>;
  offsets: { looseCents: number; onAccountCents: number } | null;
  tt: (k: keyof typeof strings.contratistas) => string;
}) {
  const pendingSum = lines.reduce((s, l) => s + l.pendingCents, 0);
  const loose = offsets?.looseCents ?? 0;
  const onAccount = offsets?.onAccountCents ?? 0;
  // Lo que no cae en ninguna de las partes anteriores: así la suma siempre da el saldo.
  const residual = balanceCents - (pendingSum + loose - onAccount);
  if (lines.length === 0 && loose === 0 && onAccount === 0 && residual === 0) return <p className="text-xs text-muted-foreground">{tt("cd_pending_none")}</p>;

  const row = (label: React.ReactNode, cents: number, key: string, sub?: string) => (
    <li key={key} className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate text-foreground">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <span className={`shrink-0 tabular-nums ${cents < 0 ? "text-destructive" : "text-muted-foreground"}`}>{formatCents(cents)}</span>
    </li>
  );

  return (
    <div className="flex max-w-lg flex-col gap-2 text-xs">
      {lines.length > 0 && <p className="font-medium text-muted-foreground">{tt("cd_pending_caption")}</p>}
      <ul className="flex flex-col gap-1.5">
        {lines.map((l) => row(l.name !== l.projectName ? l.name : l.projectName, l.pendingCents, l.contractId, l.name !== l.projectName ? l.projectName : undefined))}
        {loose !== 0 && row(tt("pay_loose"), loose, "loose")}
        {onAccount !== 0 && row(tt("cd_pending_other"), -onAccount, "on-account")}
        {residual !== 0 && row(tt("cd_pending_residual"), residual, "residual")}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm">
        <span className="font-medium text-foreground">{tt("cd_balance_line")}</span>
        <span className={`font-semibold tabular-nums ${balanceCents < 0 ? "text-destructive" : "text-foreground"}`}>{formatCents(balanceCents)}</span>
      </p>
    </div>
  );
}
