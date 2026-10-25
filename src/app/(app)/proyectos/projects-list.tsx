"use client";

import { SearchInput, ListToolbar } from "@/components/shared/search-input";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Folder, Plus } from "lucide-react";

import type { ContractorContract, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ProjectFormDialog } from "../contratistas/project-form-dialog";
import { projectPath } from "./paths";

type StatusFilter = "active" | "completed" | "all";

/**
 * Proyectos → la lista: nombre con la ubicación debajo, cuándo se creó,
 * cuántos contratos tiene (con Contratistas) y su estado. Sin montos: la
 * plata se ve dentro de cada proyecto. Arranca en los activos; la búsqueda
 * mira nombre, ubicación y cliente. Cada fila abre la ficha del proyecto.
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

  const contractCount = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) map.set(c.projectId, (map.get(c.projectId) ?? 0) + 1);
    return map;
  }, [contracts]);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => status === "all" || (status === "active" ? p.status === "ACTIVE" : p.status !== "ACTIVE"))
      .filter((p) => !q || [p.name, p.location, p.clientName].some((s) => (s ?? "").toLowerCase().includes(q)));
  }, [projects, query, status]);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tt("title")}</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">{tt("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          {tt("add")}
        </Button>
      </div>

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={tt("search_ph")} className="w-full flex-[1_1_220px] sm:max-w-xs" />
        <SegmentedFilter
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: tt("filter_active") },
            { value: "completed", label: tt("filter_completed") },
            { value: "all", label: tt("filter_all") },
          ]}
        />
      </ListToolbar>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ink-900/16 px-6 py-14 text-center">
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
        <div className="rounded-lg border border-dashed border-ink-900/16 px-6 py-10 text-center text-sm text-muted-foreground">
          {tt("no_results")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-900/8 bg-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                <th className="px-3.5 py-2 text-left font-medium">{tt("col_project")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("col_created")}</th>
                {canContracts && <th className="px-3 py-2 text-right font-medium">{tt("col_contracts")}</th>}
                <th className="px-3.5 py-2 text-right font-medium">{tt("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(projectPath(p.id))}
                  className="cursor-pointer border-b border-ink-900/8 last:border-0 hover:bg-muted/30"
                >
                  <td className="max-w-0 px-3.5 py-2.5">
                    <span className="block truncate font-semibold text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.location || tt("no_location")}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {formatDateCompact(lang, todayInPanama(new Date(p.createdAt)))}
                  </td>
                  {canContracts && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{contractCount.get(p.id) ?? 0}</td>
                  )}
                  <td className="px-3.5 py-2.5 text-right">
                    <Badge variant={p.status === "ACTIVE" ? "secondary" : "outline"}>
                      {p.status === "ACTIVE" ? tt("status_active") : tt("status_completed")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
