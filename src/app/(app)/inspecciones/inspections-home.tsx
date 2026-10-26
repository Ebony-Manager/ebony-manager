"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";

import type { InspectionProject, InspectionProjectStats } from "@/types/inspections";
import { Badge } from "@/components/ui/badge";
import { SearchInput, ListToolbar } from "@/components/shared/search-input";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { inspectionsPath } from "./paths";
import { useTi } from "./shared";

type Filter = "pending" | "active" | "all";

/**
 * Inspecciones → la lista de proyectos: los que tienen algo pendiente
 * arriba (más pendientes primero), luego por última visita y por nombre.
 * Cada fila abre las inspecciones de ese proyecto.
 */
export function InspectionsHome({ projects, stats }: { projects: InspectionProject[]; stats: Record<string, InspectionProjectStats> }) {
  const { ti, lang } = useTi();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("active");
  const withPending = projects.filter((p) => (stats[p.id]?.pending ?? 0) > 0).length;

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (filter === "pending" ? (stats[p.id]?.pending ?? 0) > 0 : filter === "active" ? p.active || (stats[p.id]?.pending ?? 0) > 0 : true))
      .filter((p) => !q || [p.name, p.location, p.clientName].some((s) => (s ?? "").toLowerCase().includes(q)))
      .sort((a, b) => {
        const sa = stats[a.id];
        const sb = stats[b.id];
        return (
          (sb?.pending ?? 0) - (sa?.pending ?? 0) ||
          (sb?.lastVisit ?? "").localeCompare(sa?.lastVisit ?? "") ||
          a.name.localeCompare(b.name, "es")
        );
      });
  }, [projects, stats, query, filter]);

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={ti("title")} subtitle={ti("subtitle")} />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={ti("search_ph")} className="w-full flex-[1_1_220px] sm:max-w-xs" />
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={[
            { value: "pending", label: `${ti("f_with_pending")} (${withPending})` },
            { value: "active", label: ti("f_active") },
            { value: "all", label: ti("f_all") },
          ]}
        />
      </ListToolbar>

      {projects.length === 0 ? (
        <EmptyState className="py-14">
          <ClipboardCheck className="size-6 text-muted-foreground" />
          {ti("empty_projects")}
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{ti("no_results")}</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {shown.map((p) => {
            const s = stats[p.id];
            return (
              <li key={p.id}>
                <Link href={inspectionsPath(p.id)} className="flex items-center gap-3 px-3.5 py-3 hover:bg-muted/30 active:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold break-words text-foreground">{p.name}</span>
                      {!p.active && <Badge variant="outline">{ti("completed")}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.clientName, p.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s
                        ? [
                            s.visits === 1 ? ti("visits_1") : ti("visits_n", { n: s.visits }),
                            s.lastVisit ? ti("last_visit", { date: formatDateCompact(lang, s.lastVisit) }) : null,
                            s.resolved > 0 ? ti("resolved_n", { n: s.resolved }) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : ti("no_visits")}
                    </p>
                  </div>
                  {s && s.pending > 0 && <Badge variant="warning">{s.pending === 1 ? ti("pending_1") : ti("pending_n", { n: s.pending })}</Badge>}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
