"use client";

import { ListToolbar, SearchInput } from "@/components/shared/search-input";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { EmptyState } from "@/components/shared/page-header";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";

import type { ContractorContract, LaborRate, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents, sortContracts } from "@/lib/contractors/contracts";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractDialog, type ContractPerson } from "./contract-dialog";
import { PROJECTS_PATH } from "../proyectos/paths";
import { ContractsTable } from "./contracts-table";

/**
 * Personal → Pagos → Contratos: todos los contratos (contratista + proyecto
 * + lo acordado) con lo abonado y lo que falta. Arriba los activos; los
 * terminados quedan plegados (se abren solos al buscar). Los proyectos (el
 * padre de los contratos) tienen su propia sección, Proyectos.
 */
export function ContractsView({
  contracts,
  contractors,
  projects,
  laborRates,
  addOpen,
  onAddOpenChange,
}: {
  contracts: ContractorContract[];
  contractors: ContractPerson[];
  projects: Project[];
  laborRates: LaborRate[];
  /** "Nuevo contrato" abierto: el botón vive en el encabezado de Pagos. */
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorContract | null>(null);
  const adding = addOpen;
  const setAdding = onAddOpenChange;

  const filtered = React.useMemo(() => {
    const q = normalizeSearchText(query);
    const list = q
      ? contracts.filter((c) =>
          [c.name, c.projectName, c.contractorName].some((s) => matchesSearch(s, q))
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
      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={tt("ct_search_ph")} className="min-w-0 flex-1 sm:max-w-xs" />
        <Button asChild size="sm" variant="ghost" className="shrink-0 text-muted-foreground">
          <Link href={PROJECTS_PATH}>
            <Folder className="size-3.5" />
            {tt("ct_tab_projects")}
          </Link>
        </Button>
      </ListToolbar>

      <div className="-mt-2">
        <p className="text-xs text-muted-foreground">
          {tt("ct_active_totals")}: {formatCents(totals.value)} · {tt("ct_col_pending").toLowerCase()}{" "}
          <span className="font-medium text-foreground">{formatCents(totals.pending)}</span>
        </p>
      </div>

      {contracts.length === 0 ? (
        <EmptyState>{tt("ct_empty")}</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>{tt("no_results")}</EmptyState>
      ) : (
        <>
          {active.length > 0 ? (
            <ContractsTable contracts={active} onOpen={setEditing} showContractor />
          ) : (
            <EmptyState className="py-6">{tt("ct_no_active")}</EmptyState>
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

      <ContractDialog
        open={adding || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        contract={editing}
        contractors={contractors}
        projects={projects}
        laborRates={laborRates}
        onSaved={() => router.refresh()}
        onProjectsChanged={() => router.refresh()}
      />
    </div>
  );
}
