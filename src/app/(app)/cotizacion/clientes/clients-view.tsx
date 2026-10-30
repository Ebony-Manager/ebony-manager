"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { Client, ClientKind, Opportunity } from "@/types/ventas";
import { Button } from "@/components/ui/button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ListToolbar, SearchInput } from "@/components/shared/search-input";
import { EmptyState, PAGE_CLASS, PageHeader, ShowToggle } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatMoney } from "@/lib/cotizador/pricing";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { clientStats } from "@/lib/ventas/opportunities";
import { cn } from "@/lib/utils";
import { CotizacionTabs, KindBadge, useTv } from "../ventas-common";
import type { SalesProject } from "../seguimiento/opportunity-dialog";
import { ClientDialog } from "./client-dialog";

type KindFilter = "all" | ClientKind;

/**
 * Cotización → Clientes: arquitectos/diseñadores y clientes finales, con
 * cuánto se les ha cotizado y aprobado. Tocar uno abre su ficha (datos,
 * oportunidades y proyectos).
 */
export function ClientsView({ clients, opportunities, projects }: { clients: Client[]; opportunities: Opportunity[]; projects: SalesProject[] }) {
  const { tv, lang } = useTv();
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<Client | "new" | null>(null);

  const rows = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return clients
      .filter((c) => c.active || showInactive)
      .filter((c) => kind === "all" || c.kind === kind)
      .filter((c) => !q || matchesSearch(`${c.name} ${c.company ?? ""} ${c.phone ?? ""} ${c.whatsapp ?? ""} ${c.email ?? ""} ${c.contacts.map((k) => k.name).join(" ")}`, q))
      .map((c) => ({ client: c, stats: clientStats(c.id, opportunities) }));
  }, [clients, opportunities, kind, query, showInactive]);
  const count = (k: KindFilter) => clients.filter((c) => (c.active || showInactive) && (k === "all" || c.kind === k)).length;
  const editingNow = editing && editing !== "new" ? (clients.find((c) => c.id === editing.id) ?? editing) : editing;

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={tv("cli_title")}
        subtitle={tv("cli_subtitle")}
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" />
            {tv("new_client")}
          </Button>
        }
      />
      <CotizacionTabs value="clientes" />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={tv("cli_search_ph")} className="w-full flex-[1_1_220px] sm:max-w-sm" />
        <SegmentedFilter
          value={kind}
          onChange={setKind}
          options={(["all", "arquitecto", "cliente"] as const).map((k) => ({
            value: k,
            label: `${k === "all" ? tv("filter_all") : tv(`kind_${k}_plural`)} (${count(k)})`,
          }))}
        />
      </ListToolbar>

      {clients.length === 0 ? (
        <EmptyState>
          {tv("cli_empty")}
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" />
            {tv("new_client")}
          </Button>
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>{tv("no_results")}</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map(({ client: c, stats }) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className={cn("flex w-full flex-col gap-1 rounded-lg border border-border bg-card px-3.5 py-3 text-left", !c.active && "opacity-60")}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <KindBadge kind={c.kind} />
                  </span>
                  {(c.company || c.phone || c.contacts.length > 0) && (
                    <span className="text-xs text-muted-foreground">{[c.company, c.phone, c.contacts.map((k) => k.name).join(", ")].filter(Boolean).join(" · ")}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {stats.opportunities.length} {tv("cli_opps").toLowerCase()} · {tv("cli_approved")} {formatMoney(stats.approved)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3.5 py-2 text-left font-medium">{tv("f_name")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tv("f_phone")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tv("cli_opps")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tv("cli_quoted")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tv("cli_approved")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tv("cli_close_rate")}</th>
                  <th className="px-3.5 py-2 text-left font-medium">{tv("cli_last")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ client: c, stats }) => (
                  <tr key={c.id} onClick={() => setEditing(c)} className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-muted/30", !c.active && "opacity-60")}>
                    <td className="min-w-[240px] px-3.5 py-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <KindBadge kind={c.kind} />
                      </span>
                      {(c.company || c.contacts.length > 0) && (
                        <span className="block text-xs text-muted-foreground">{[c.company, c.contacts.map((k) => k.name).join(", ")].filter(Boolean).join(" · ")}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{stats.opportunities.length}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{stats.quoted ? formatMoney(stats.quoted) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{stats.approved ? formatMoney(stats.approved) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{stats.closeRate == null ? "—" : `${Math.round(stats.closeRate * 100)}%`}</td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-muted-foreground">{stats.lastOn ? formatDateCompact(lang, stats.lastOn) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {clients.some((c) => !c.active) && <ShowToggle className="self-end" checked={showInactive} onChange={setShowInactive} label={tv("show_inactive")} />}

      <ClientDialog client={editingNow} clients={clients} opportunities={opportunities} projects={projects} onClose={() => setEditing(null)} />
    </div>
  );
}
