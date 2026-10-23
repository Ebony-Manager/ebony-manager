"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder, Plus, Search } from "lucide-react";

import type { ContractorContract, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents } from "@/lib/contractors/contracts";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ProjectFormDialog } from "../contratistas/project-form-dialog";
import { projectPath } from "./paths";

type StatusFilter = "active" | "completed" | "all";

/**
 * Proyectos → la lista. Arranca en los activos; la búsqueda (nombre o
 * cliente) mira en el filtro elegido. Cada fila abre la ficha del proyecto.
 * Con Contratistas se ve además cuántos contratos tiene y lo que falta por
 * pagar de ellos.
 */
export function ProjectsList({
  projects,
  contracts,
  canContracts,
}: {
  projects: Project[];
  contracts: ContractorContract[];
  canContracts: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("active");
  const [adding, setAdding] = React.useState(false);

  const byProject = React.useMemo(() => {
    const map = new Map<string, { total: number; active: number; pending: number }>();
    for (const c of contracts) {
      const cur = map.get(c.projectId) ?? { total: 0, active: 0, pending: 0 };
      cur.total += 1;
      if (c.status === "ACTIVE") cur.active += 1;
      cur.pending += Math.max(0, contractPendingCents(c));
      map.set(c.projectId, cur);
    }
    return map;
  }, [contracts]);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => status === "all" || (status === "active" ? p.status === "ACTIVE" : p.status !== "ACTIVE"))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.clientName ?? "").toLowerCase().includes(q));
  }, [projects, query, status]);

  const countLabel = (s: { total: number; active: number }) =>
    tt("contracts_count").replace("{active}", String(s.active)).replace("{total}", String(s.total));

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tt("title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          {tt("add")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-[1_1_220px] sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder={tt("search_ph")}
            aria-label={tt("search_ph")}
            className="h-8 w-full border border-input bg-card pr-2.5 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </label>
        <SegmentedFilter
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: tt("filter_active") },
            { value: "completed", label: tt("filter_completed") },
            { value: "all", label: tt("filter_all") },
          ]}
        />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-ink-900/16 px-6 py-14 text-center">
          <div className="flex size-14 items-center justify-center bg-cream-100">
            <Folder className="size-6 text-walnut" />
          </div>
          <p className="font-semibold">{tt("empty")}</p>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            {tt("add")}
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-ink-900/16 px-6 py-10 text-center text-sm text-muted-foreground">
          {tt("no_results")}
        </div>
      ) : (
        <ul className="flex flex-col border border-ink-900/8 bg-card">
          {shown.map((p) => {
            const s = byProject.get(p.id);
            return (
              <li key={p.id} className="border-b border-ink-900/8 last:border-0">
                <Link
                  href={projectPath(p.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5 hover:bg-muted/30"
                >
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col">
                    <span className="truncate font-semibold text-foreground">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.clientName || tt("none")}</span>
                  </span>
                  {canContracts && (
                    <span className="w-36 text-xs text-muted-foreground">{s ? countLabel(s) : tt("no_contracts_short")}</span>
                  )}
                  {canContracts && (
                    <span className="w-28 text-right text-sm tabular-nums text-foreground" title={tt("col_pending")}>
                      {s && s.pending > 0 ? formatCents(s.pending) : "—"}
                    </span>
                  )}
                  <Badge variant={p.status === "ACTIVE" ? "secondary" : "outline"}>
                    {p.status === "ACTIVE" ? tt("status_active") : tt("status_completed")}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectFormDialog
        project={null}
        open={adding}
        onOpenChange={setAdding}
        onCreated={(p) => router.push(projectPath(p.id))}
      />
    </div>
  );
}
