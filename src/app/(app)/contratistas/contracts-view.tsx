"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";

import type { ContractorContract, LaborRate, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents, sortContracts } from "@/lib/contractors/contracts";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractDialog, type ContractPerson } from "./contract-dialog";
import { ProjectsView } from "./projects-view";
import { ContractsTable } from "./contracts-table";

/**
 * Personal → Pagos → Contratos: todos los contratos (contratista + proyecto
 * + lo acordado) con lo abonado y lo que falta. Arriba los activos; los
 * terminados quedan plegados (se abren solos al buscar). Desde acá también
 * se manejan los proyectos, que son el padre de los contratos.
 */
export function ContractsView({
  contracts,
  contractors,
  projects,
  laborRates,
  actions,
}: {
  contracts: ContractorContract[];
  contractors: ContractPerson[];
  projects: Project[];
  laborRates: LaborRate[];
  /** Botones extra junto a "Nuevo contrato" (ej. Tarifas). */
  actions?: React.ReactNode;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [view, setView] = React.useState<"contracts" | "projects">("contracts");
  const [query, setQuery] = React.useState("");
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorContract | null>(null);
  const [adding, setAdding] = React.useState(false);
  // Proyecto ya elegido al crear desde la ficha de un proyecto.
  const [addingForProject, setAddingForProject] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? contracts.filter((c) =>
          [c.name, c.projectName, c.contractorName].some((s) => s.toLowerCase().includes(q))
        )
      : contracts;
    return sortContracts(list);
  }, [contracts, query]);
  const active = filtered.filter((c) => c.status === "ACTIVE");
  const completed = filtered.filter((c) => c.status !== "ACTIVE");
  const completedOpen = showCompleted || query.trim() !== "";

  const totals = React.useMemo(() => {
    const act = contracts.filter((c) => c.status === "ACTIVE");
    return {
      value: act.reduce((s, c) => s + c.valueCents, 0),
      pending: act.reduce((s, c) => s + Math.max(0, contractPendingCents(c)), 0),
    };
  }, [contracts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as "contracts" | "projects")}>
          <TabsList className="h-8">
            <TabsTrigger value="contracts" className="px-3 text-xs">
              {tt("ct_tab_contracts")}
            </TabsTrigger>
            <TabsTrigger value="projects" className="px-3 text-xs">
              {tt("ct_tab_projects")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "contracts" && (
          <div className="flex items-center gap-2">
            {actions}
            <Button
              size="sm"
              onClick={() => {
                setAddingForProject(null);
                setAdding(true);
              }}
            >
              <Plus className="size-3.5" />
              {tt("ct_add")}
            </Button>
          </div>
        )}
      </div>

      {view === "projects" ? (
        <ProjectsView
          projects={projects}
          contracts={contracts}
          onOpenContract={setEditing}
          onAddContract={(projectId) => {
            setAddingForProject(projectId);
            setAdding(true);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={tt("ct_search_ph")} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
            <p className="text-xs text-muted-foreground">
              {tt("ct_active_totals")}: {formatCents(totals.value)} · {tt("ct_col_pending").toLowerCase()}{" "}
              <span className="font-medium text-foreground">{formatCents(totals.pending)}</span>
            </p>
          </div>

          {contracts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-10 text-center text-sm text-muted-foreground">
              {tt("ct_empty")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-10 text-center text-sm text-muted-foreground">
              {tt("no_results")}
            </div>
          ) : (
            <>
              {active.length > 0 ? (
                <ContractsTable contracts={active} onOpen={setEditing} showContractor />
              ) : (
                <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-6 text-center text-sm text-muted-foreground">
                  {tt("ct_no_active")}
                </div>
              )}
              {completed.length > 0 && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    {completedOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    {tt("proj_completed_section")} ({completed.length})
                  </button>
                  {completedOpen && <ContractsTable contracts={completed} onOpen={setEditing} showContractor />}
                </div>
              )}
            </>
          )}
        </>
      )}

      <ContractDialog
        open={adding || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setAddingForProject(null);
            setEditing(null);
          }
        }}
        contract={editing}
        defaultProjectId={addingForProject}
        contractors={contractors}
        projects={projects}
        laborRates={laborRates}
        onSaved={() => router.refresh()}
        onProjectsChanged={() => router.refresh()}
      />
    </div>
  );
}
