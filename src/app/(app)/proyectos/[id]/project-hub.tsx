"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import type { ContractorContract, LaborRate, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { contractPendingCents, sortContracts } from "@/lib/contractors/contracts";
import { contractorProfilePath } from "@/lib/personal/paths";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractsTable } from "../../contratistas/contracts-table";
import { ContractDialog, type ContractPerson } from "../../contratistas/contract-dialog";
import { ProjectFormDialog } from "../../contratistas/project-form-dialog";
import { DeleteProjectDialog } from "../../contratistas/delete-project-dialog";
import { PROJECTS_PATH, projectPath } from "../paths";
import { BackLink, PAGE_CLASS, SubTabs } from "@/components/shared/page-header";

type SectionKey = "resumen" | "contratos";

/**
 * La ficha de un proyecto: encabezado (nombre, cliente, estado, editar /
 * borrar) y una pestaña por cada cosa que cuelga del proyecto. Hoy:
 * Resumen y Contratos. Lo que se vaya sumando (cotizaciones, inspecciones,
 * autorizaciones, inventario entregado…) entra como otra pestaña en
 * `sections`, con su propio permiso.
 */
export function ProjectHub({
  project,
  initialTab,
  canContracts,
  contracts,
  contractors,
  projects,
  laborRates,
}: {
  project: Project;
  initialTab?: string;
  canContracts: boolean;
  contracts: ContractorContract[];
  contractors: ContractPerson[];
  projects: Project[];
  laborRates: LaborRate[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const router = useRouter();

  const sections: { key: SectionKey; label: string; visible: boolean }[] = [
    { key: "resumen", label: tt("tab_resumen"), visible: true },
    { key: "contratos", label: tt("tab_contratos"), visible: canContracts },
  ];
  const visible = sections.filter((s) => s.visible);
  const [tab, setTab] = React.useState<SectionKey>(
    visible.find((s) => s.key === initialTab)?.key ?? "resumen"
  );

  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [contractEditing, setContractEditing] = React.useState<ContractorContract | null>(null);
  const [contractAdding, setContractAdding] = React.useState(false);

  const changeTab = (next: string) => {
    setTab(next as SectionKey);
    router.replace(projectPath(project.id, next === "resumen" ? undefined : next), { scroll: false });
  };

  const isActive = project.status === "ACTIVE";

  return (
    <div className={PAGE_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <BackLink href={PROJECTS_PATH} label={tt("back")} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={tt("menu")} title={tt("menu")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => window.setTimeout(() => setDeleting(true), 0)}>
              <Trash2 className="size-3.5" />
              {tt("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
            {project.name}
            <Badge variant={isActive ? "secondary" : "outline"}>
              {isActive ? tt("status_active") : tt("status_completed")}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {[project.location, project.clientName].filter(Boolean).join(" · ") || tt("no_location")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          {tt("edit")}
        </Button>
      </div>

      <SubTabs value={tab} onChange={changeTab} tabs={visible.map((s) => ({ value: s.key, label: s.label }))} />

      {tab === "resumen" && (
        <Overview project={project} canContracts={canContracts} contracts={contracts} onOpenContracts={() => changeTab("contratos")} />
      )}
      {tab === "contratos" && canContracts && (
        <ContractsSection contracts={contracts} onOpen={setContractEditing} onAdd={() => setContractAdding(true)} />
      )}

      <ProjectFormDialog project={project} open={editing} onOpenChange={setEditing} onSaved={() => router.refresh()} />
      <DeleteProjectDialog
        project={project}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => router.push(PROJECTS_PATH)}
      />
      {canContracts && (
        <ContractDialog
          open={contractAdding || contractEditing !== null}
          onOpenChange={(o) => {
            if (!o) {
              setContractAdding(false);
              setContractEditing(null);
            }
          }}
          contract={contractEditing}
          contractors={contractors}
          defaultProjectId={project.id}
          projects={projects}
          laborRates={laborRates}
          onSaved={() => router.refresh()}
          onProjectsChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

/** Resumen: la información general y, con Contratistas, la plata de sus contratos. */
function Overview({
  project,
  canContracts,
  contracts,
  onOpenContracts,
}: {
  project: Project;
  canContracts: boolean;
  contracts: ContractorContract[];
  onOpenContracts: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);

  const totals = React.useMemo(() => {
    let value = 0;
    let paid = 0;
    let pending = 0;
    let retained = 0;
    for (const c of contracts) {
      const p = Math.max(0, contractPendingCents(c));
      value += c.valueCents;
      paid += c.allocatedCents;
      pending += p;
      retained += Math.min(c.retentionCents, p);
    }
    return { value, paid, pending, retained, active: contracts.filter((c) => c.status === "ACTIVE").length };
  }, [contracts]);

  // Quién trabaja en el proyecto (cada uno una vez), con lo que le falta.
  const people = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; pending: number }>();
    for (const c of contracts) {
      const cur = map.get(c.contractorId) ?? { id: c.contractorId, name: c.contractorName, pending: 0 };
      cur.pending += Math.max(0, contractPendingCents(c));
      map.set(c.contractorId, cur);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [contracts]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tt("info_title")}</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          <Item label={tt("f_location")} value={project.location || tt("none")} />
          <Item label={tt("f_client")} value={project.clientName || tt("none")} />
          <Item
            label={tt("f_status")}
            value={project.status === "ACTIVE" ? tt("status_active") : tt("status_completed")}
          />
          <Item label={tt("f_created")} value={formatDateCompact(lang, todayInPanama(new Date(project.createdAt)))} />
          <div className="col-span-2 sm:col-span-4">
            <Item label={tt("f_notes")} value={project.notes || tt("none")} />
          </div>
        </dl>
      </Card>

      {canContracts && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{tt("money_title")}</h2>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onOpenContracts}>
              {tt("tab_contratos")}
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tt("no_contracts")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label={tt("kpi_contracts")}
                  value={tt("contracts_count").replace("{active}", String(totals.active)).replace("{total}", String(contracts.length))}
                />
                <Stat label={tt("kpi_value")} value={formatCents(totals.value)} />
                <Stat label={tt("kpi_paid")} value={formatCents(totals.paid)} />
                <Stat
                  label={tt("kpi_pending")}
                  value={formatCents(totals.pending)}
                  sub={totals.retained > 0 ? `${tt("kpi_retained")} ${formatCents(totals.retained)}` : undefined}
                  strong
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{tt("contractors_title")}</p>
                <ul className="flex flex-wrap gap-2">
                  {people.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={contractorProfilePath(p.id)}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted/40"
                      >
                        <span className="text-foreground">{p.name}</span>
                        {p.pending > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatCents(p.pending)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/** Contratos del proyecto: activos arriba, terminados plegados. */
function ContractsSection({
  contracts,
  onOpen,
  onAdd,
}: {
  contracts: ContractorContract[];
  onOpen: (c: ContractorContract) => void;
  onAdd: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const [showCompleted, setShowCompleted] = React.useState(false);

  const sorted = React.useMemo(() => sortContracts(contracts), [contracts]);
  const active = sorted.filter((c) => c.status === "ACTIVE");
  const completed = sorted.filter((c) => c.status !== "ACTIVE");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-3.5" />
          {tt("add_contract")}
        </Button>
      </div>
      {contracts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{tt("no_contracts")}</p>
      ) : (
        <>
          {active.length > 0 && <ContractsTable contracts={active} onOpen={onOpen} showContractor />}
          {completed.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showCompleted ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                {tt("completed_section")} ({completed.length})
              </button>
              {showCompleted && <ContractsTable contracts={completed} onOpen={onOpen} showContractor />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
  );
}

function Stat({ label, value, sub, strong = false }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular-nums text-foreground ${strong ? "font-semibold" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
