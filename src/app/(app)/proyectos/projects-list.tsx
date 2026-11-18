"use client";

import { SearchInput, ListToolbar } from "@/components/shared/search-input";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Folder, Plus } from "lucide-react";

import type { ContractorContract, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ProjectFormDialog } from "../contratistas/project-form-dialog";
import { projectPath } from "./paths";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";

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
  canCreate = true,
  mineIds,
  designerNames = {},
}: {
  projects: Project[];
  contracts: ContractorContract[];
  canContracts: boolean;
  /** false = diseñadora: ve sus proyectos pero no crea nuevos. */
  canCreate?: boolean;
  /** Solo diseñadoras: ids de los proyectos que lleva (muestra el filtro Todos / Míos). */
  mineIds?: string[];
  /** Diseñadoras de cada proyecto (id del proyecto → nombres). */
  designerNames?: Record<string, string[]>;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("active");
  const [adding, setAdding] = React.useState(false);
  const [scope, setScope] = React.useState<"all" | "mine">("all");

  const contractCount = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) map.set(c.projectId, (map.get(c.projectId) ?? 0) + 1);
    return map;
  }, [contracts]);

  const shown = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return projects
      .filter((p) => status === "all" || (status === "active" ? p.status === "ACTIVE" : p.status !== "ACTIVE"))
      .filter((p) => scope === "all" || !mineIds || mineIds.includes(p.id))
      .filter((p) => !q || [p.name, p.location, p.clientName].some((s) => matchesSearch(s, q)));
  }, [projects, query, status, scope, mineIds]);

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={tt("title")}
        subtitle={tt("subtitle")}
        action={
          canCreate ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              {tt("add")}
            </Button>
          ) : undefined
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={tt("search_ph")} className="w-full flex-[1_1_220px] sm:max-w-xs" />
        <SegmentedFilter
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: tt("filter_active"), icon: STATUS.project_active.icon, iconClass: TONE_TEXT[STATUS.project_active.tone] },
            { value: "completed", label: tt("filter_completed"), icon: STATUS.project_completed.icon, iconClass: TONE_TEXT[STATUS.project_completed.tone] },
            { value: "all", label: tt("filter_all"), icon: ICON.all },
          ]}
        />
        {mineIds && (
          <SegmentedFilter
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: tt("scope_all"), icon: ICON.all },
              { value: "mine", label: tt("scope_mine"), icon: ICON.designer },
            ]}
          />
        )}
      </ListToolbar>

      {projects.length === 0 ? (
        <EmptyState size="page">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Folder className="size-6 text-primary" />
          </div>
          <p className="font-semibold text-foreground">{tt("empty")}</p>
          {canCreate && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              {tt("add")}
            </Button>
          )}
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{tt("no_results")}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full table-fixed border-collapse text-sm sm:min-w-[720px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3.5 py-2 text-left font-medium sm:w-[42%]">{tt("col_project")}</th>
                <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">{tt("col_designers")}</th>
                <th className="hidden w-28 px-3 py-2 text-left font-medium sm:table-cell">{tt("col_created")}</th>
                {canContracts && <th className="hidden w-24 px-3 py-2 text-right font-medium sm:table-cell">{tt("col_contracts")}</th>}
                <th className="w-32 px-3.5 py-2 text-right font-medium">{tt("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(projectPath(p.id))}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="max-w-0 px-3.5 py-2.5">
                    <span className="block truncate font-semibold text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.location || tt("no_location")}</span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-foreground sm:table-cell">
                    <span className="block truncate">{designerNames[p.id]?.join(", ") || <span className="text-muted-foreground">—</span>}</span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground sm:table-cell">
                    {formatDateCompact(lang, todayInPanama(new Date(p.createdAt)))}
                  </td>
                  {canContracts && (
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground sm:table-cell">{contractCount.get(p.id) ?? 0}</td>
                  )}
                  <td className="px-3.5 py-2.5 text-right">
                    <StatusBadge status={p.status === "ACTIVE" ? "project_active" : "project_completed"}>
                      {p.status === "ACTIVE" ? tt("status_active") : tt("status_completed")}
                    </StatusBadge>
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
