"use client";

import { ListToolbar, SearchInput } from "@/components/shared/search-input";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { EmptyState } from "@/components/shared/page-header";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder } from "lucide-react";

import type { ContractorContract, LaborRate, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents, contractStage, sortContracts, type ContractStage } from "@/lib/contractors/contracts";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
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
  const [stageFilter, setStageFilter] = React.useState<"active" | ContractStage>("active");
  const [contractorFilter, setContractorFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<ContractorContract | null>(null);
  const adding = addOpen;
  const setAdding = onAddOpenChange;

  const stageCounts = React.useMemo(() => {
    const c = { in_progress: 0, to_close: 0, completed: 0 };
    for (const k of contracts) c[contractStage(k)]++;
    return c;
  }, [contracts]);
  const contractorOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const k of contracts) byId.set(k.contractorId, k.contractorName);
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [contracts]);

  const filtered = React.useMemo(() => {
    const q = normalizeSearchText(query);
    const list = contracts.filter((c) => {
      if (contractorFilter !== "all" && c.contractorId !== contractorFilter) return false;
      const st = contractStage(c);
      if (stageFilter === "active" ? st === "completed" : st !== stageFilter) return false;
      return !q || [c.name, c.projectName, c.contractorName].some((x) => matchesSearch(x, q));
    });
    return sortContracts(list);
  }, [contracts, query, stageFilter, contractorFilter]);

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

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          fill
          value={stageFilter}
          onChange={setStageFilter}
          options={[
            { value: "active" as const, label: tt("ct_stage_active"), icon: STATUS.contract_in_progress.icon, iconClass: TONE_TEXT[STATUS.contract_in_progress.tone] },
            { value: "to_close" as const, label: `${tt("ct_stage_to_close")} (${stageCounts.to_close})`, icon: STATUS.contract_to_close.icon, iconClass: TONE_TEXT[STATUS.contract_to_close.tone] },
            { value: "completed" as const, label: tt("ct_stage_completed"), icon: STATUS.contract_completed.icon, iconClass: TONE_TEXT[STATUS.contract_completed.tone] },
          ]}
        />
        <Select value={contractorFilter} onValueChange={setContractorFilter}>
          <SelectTrigger className="h-9 w-full min-w-48 sm:w-auto">
            <ICON.owner className="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("ct_all_contractors")}</SelectItem>
            {contractorOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stageFilter === "active" && (
        <p className="-mt-1 text-xs text-muted-foreground">
          {tt("ct_active_totals")} {formatCents(totals.value)} · {tt("ct_col_pending")}{" "}
          <span className="font-medium text-foreground">{formatCents(totals.pending)}</span>
        </p>
      )}

      {contracts.length === 0 ? (
        <EmptyState>{tt("ct_empty")}</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>{query.trim() || contractorFilter !== "all" ? tt("no_results") : tt("ct_no_active")}</EmptyState>
      ) : (
        <ContractsTable contracts={filtered} onOpen={setEditing} showContractor />
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
