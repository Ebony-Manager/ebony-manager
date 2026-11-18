"use client";

import { SearchInput, ListToolbar } from "@/components/shared/search-input";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Folder, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListGroupHeader } from "@/components/shared/list-group-header";

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
type SortBy = "name" | "recent" | "designer";
const SORT_KEY = "proyectos.sort";

function readSort(): SortBy | null {
  try {
    const v = window.localStorage.getItem(SORT_KEY);
    return v === "name" || v === "recent" || v === "designer" ? v : null;
  } catch {
    return null;
  }
}
function saveSort(v: SortBy) {
  try {
    window.localStorage.setItem(SORT_KEY, v);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

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
  const [sortBy, setSortBy] = React.useState<SortBy>("name");
  // El orden de la última vez (por persona y navegador).
  /* eslint-disable react-hooks/set-state-in-effect -- se lee el navegador una vez al abrir. */
  React.useEffect(() => {
    const saved = readSort();
    if (saved) setSortBy(saved);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      .filter((p) => !q || [p.name, p.location, p.clientName].some((s) => matchesSearch(s, q)))
      .sort((a, b) => (sortBy === "recent" ? b.createdAt.localeCompare(a.createdAt) : a.name.localeCompare(b.name, "es")));
  }, [projects, query, status, scope, mineIds, sortBy]);

  // Por diseñadora: un grupo por cada una (un proyecto con dos diseñadoras sale en los dos grupos) y al final los
  // que no tienen; dentro de cada grupo, por nombre.
  const groups = React.useMemo(() => {
    if (sortBy !== "designer") return null;
    const map = new Map<string, Project[]>();
    const none: Project[] = [];
    for (const p of shown) {
      const names = designerNames[p.id] ?? [];
      if (names.length === 0) none.push(p);
      for (const n of names) map.set(n, [...(map.get(n) ?? []), p]);
    }
    const out = [...map.entries()].sort((x, y) => x[0].localeCompare(y[0], "es")).map(([title, list]) => ({ title, list }));
    if (none.length) out.push({ title: tt("no_designer"), list: none });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tt depende solo del idioma.
  }, [shown, sortBy, designerNames, lang]);

  const renderTable = (list: Project[]) => (
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
              {list.map((p) => (
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
  );

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
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v as SortBy);
            saveSort(v as SortBy);
          }}
        >
          <SelectTrigger className="h-9 w-full min-w-44 sm:w-auto">
            <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{tt("sort_name")}</SelectItem>
            <SelectItem value="recent">{tt("sort_recent")}</SelectItem>
            <SelectItem value="designer">{tt("sort_designer")}</SelectItem>
          </SelectContent>
        </Select>
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
        <EmptyState size="page" icon={Folder}>
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
        groups ? (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.title} className="flex flex-col gap-2">
                <ListGroupHeader title={g.title} count={g.list.length} icon={ICON.designer} />
                {renderTable(g.list)}
              </section>
            ))}
          </div>
        ) : (
          renderTable(shown)
        )
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
