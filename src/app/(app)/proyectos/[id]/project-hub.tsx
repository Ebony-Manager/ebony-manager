"use client";

import * as React from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, ChevronRight, Handshake, Hourglass, Info, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import type { ContractorContract, LaborRate, Project } from "@/types/contractors";
import type { Inspection, InspectionPainter } from "@/types/inspections";
import type { ProjectSupplyLine } from "@/types/almacen";
import type { QuoteSummary } from "@/types/cotizador";
import { QuoteRows } from "../../cotizacion/quote-rows";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProfileCard } from "@/components/shared/profile-card";
import { KpiCard } from "@/components/shared/kpi-card";
import { ICON } from "@/lib/ui/concepts";
import type { TallerPainter, TallerPerson, TallerProject, VeneerType, WorkOrder } from "@/types/taller";
import { ProjectWorkOrders } from "@/app/(app)/taller/project-work-orders";
import { ProjectItems } from "@/app/(app)/diseno/project-items";
import type { ProjectItem } from "@/types/diseno";
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
import { InspectionsBoard } from "../../inspecciones/inspections-board";
import { ProjectSupplies } from "./project-supplies";
import { ProjectDeliveries } from "./project-deliveries";
import { ProjectDesigners } from "./project-designers";
import { DesignerQuoteRows } from "./designer-quote-rows";
import type { DesignerCandidate, DesignerQuoteSummary, ProjectDesigner } from "@/types/designers";
import { ProjectPresentation } from "./project-presentation";
import type { ProjectDelivery } from "@/types/deliveries";
import { DriveFiles } from "@/components/shared/drive-files";
import { usePageTitle } from "@/components/shared/page-title";
import { ensureProjectFolderAction } from "../../drive-actions";
import { PROJECTS_PATH, projectPath } from "../paths";
import { BackLink, PAGE_CLASS, SubTabs, EmptyState, ShowToggle } from "@/components/shared/page-header";
import { projectAddress } from "@/lib/proyectos/address";

type SectionKey = "resumen" | "diseno" | "cotizaciones" | "contratos" | "inspecciones" | "suministros" | "presentacion" | "pintura" | "embalaje" | "entregas" | "archivos" | "taller";

/**
 * La ficha de un proyecto: encabezado (nombre, cliente, estado, editar /
 * borrar) y una pestaña por cada cosa que cuelga del proyecto. Hoy:
 * Resumen, Contratos, Inspecciones y Suministros. Lo que se vaya sumando (cotizaciones,
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
  canInspections,
  inspections,
  painters,
  supplies,
  drive,
  projectPeople,
  canQuotes = false,
  quotes = [],
  deliveries = [],
  unassignedDeliveries = [],
  designerView = false,
  designers = [],
  designerCandidates = [],
  designerQuotes = [],
  taller = null,
  design = null,
}: {
  project: Project;
  initialTab?: string;
  canContracts: boolean;
  contracts: ContractorContract[];
  contractors: ContractPerson[];
  projects: Project[];
  laborRates: LaborRate[];
  canInspections: boolean;
  inspections: Inspection[];
  painters: InspectionPainter[];
  supplies: ProjectSupplyLine[];
  /** Carpeta del proyecto en Google Drive (heredada de su oportunidad o creada aquí). */
  drive: { enabled: boolean; folderId: string | null };
  /** Nombres del arquitecto/diseñador (con su contacto) y del cliente final. */
  projectPeople: { designer: string | null; client: string | null };
  /** Con Cotización: las aprobadas que lo crearon y sus adicionales. */
  canQuotes?: boolean;
  quotes?: QuoteSummary[];
  /** Actas de entrega del proyecto, y las que llegaron sin proyecto. */
  deliveries?: ProjectDelivery[];
  unassignedDeliveries?: ProjectDelivery[];
  /** Diseñadora (permiso Diseño sin administrar proyectos): solo lectura, cotización sin precios, sin contratos ni archivos. */
  designerView?: boolean;
  /** Las diseñadoras de Ebony asignadas a este proyecto, y a quién se puede asignar. */
  designers?: ProjectDesigner[];
  designerCandidates?: DesignerCandidate[];
  /** Las cotizaciones del proyecto sin montos (para la diseñadora). */
  designerQuotes?: DesignerQuoteSummary[];
  /** Con Taller: los trabajos de este proyecto, y nombres/fotos/proyectos para crearlos. */
  /** Los ítems (muebles) del proyecto y sus etapas de diseño. */
  design?: { items: ProjectItem[]; pendingFromQuote: number } | null;
  taller?: { orders: WorkOrder[]; people: TallerPerson[]; projects: TallerProject[]; painters: TallerPainter[]; veneers: VeneerType[] } | null;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const router = useRouter();

  const sections: { key: SectionKey; label: string; visible: boolean }[] = [
    { key: "resumen", label: tt("tab_resumen"), visible: true },
    { key: "diseno", label: tt("tab_diseno"), visible: !!design },
    { key: "cotizaciones", label: tt("tab_cotizaciones"), visible: canQuotes || designerView },
    { key: "contratos", label: tt("tab_contratos"), visible: canContracts },
    { key: "inspecciones", label: tt("tab_inspecciones"), visible: canInspections },
    { key: "taller", label: tt("tab_taller"), visible: !!taller },
    { key: "suministros", label: tt("tab_suministros"), visible: !designerView },
    { key: "pintura", label: tt("tab_pintura"), visible: true },
    { key: "presentacion", label: tt("tab_presentacion"), visible: drive.enabled },
    { key: "embalaje", label: tt("tab_embalaje"), visible: true },
    { key: "entregas", label: tt("tab_entregas"), visible: true },
    { key: "archivos", label: tt("tab_archivos"), visible: drive.enabled },
  ];
  const visible = sections.filter((s) => s.visible);
  const [tab, setTab] = React.useState<SectionKey>(
    visible.find((s) => s.key === initialTab)?.key ?? "resumen"
  );
  // Nombre de la pestaña: "Royal Palace · Proyecto" (o "· Inspecciones" en esa pestaña).
  usePageTitle([project.name, tab === "resumen" ? t(lang, strings.titles.project) : sections.find((s) => s.key === tab)?.label]);

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
        {!designerView && (
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
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
            {project.name}
            <StatusBadge status={isActive ? "project_active" : "project_completed"}>
              {isActive ? tt("status_active") : tt("status_completed")}
            </StatusBadge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {[projectAddress(project), project.clientName].filter(Boolean).join(" · ") || tt("no_location")}
          </p>
        </div>
        {!designerView && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            {tt("edit")}
          </Button>
        )}
      </div>

      <SubTabs value={tab} onChange={changeTab} tabs={visible.map((s) => ({ value: s.key, label: s.label }))} />

      {tab === "resumen" && (
        <>
          <Overview project={project} people={projectPeople} canContracts={canContracts} contracts={contracts} onOpenContracts={() => changeTab("contratos")} />
          <ProjectDesigners projectId={project.id} designers={designers} candidates={designerCandidates} canEdit={!designerView} />
        </>
      )}
      {tab === "cotizaciones" && designerView && <DesignerQuoteRows projectId={project.id} quotes={designerQuotes} />}
      {tab === "cotizaciones" && canQuotes && !designerView && <QuoteRows quotes={quotes} newHref={`/cotizacion/nueva?proyecto=${project.id}`} />}
      {tab === "contratos" && canContracts && (
        <ContractsSection contracts={contracts} onOpen={setContractEditing} onAdd={() => setContractAdding(true)} />
      )}
      {tab === "inspecciones" && canInspections && <InspectionsBoard project={project} inspections={inspections} painters={painters} />}
      {tab === "taller" && taller && <ProjectWorkOrders projectId={project.id} {...taller} />}
      {tab === "diseno" && design && <ProjectItems projectId={project.id} items={design.items} pendingFromQuote={design.pendingFromQuote} />}
      {tab === "suministros" && <ProjectSupplies lines={supplies} />}
      {tab === "presentacion" && <ProjectPresentation projectId={project.id} driveEnabled={drive.enabled} />}
      {(tab === "entregas" || tab === "pintura" || tab === "embalaje") && (
        <ProjectDeliveries
          key={tab}
          project={project}
          kind={tab === "entregas" ? "entrega" : tab}
          readOnly={designerView}
          deliveries={deliveries.filter((d) => d.kind === (tab === "entregas" ? "entrega" : tab))}
          unassigned={unassignedDeliveries.filter((d) => d.kind === (tab === "entregas" ? "entrega" : tab))}
        />
      )}
      {tab === "archivos" && (
        <DriveFiles
          enabled={drive.enabled}
          folderId={drive.folderId}
          onCreate={async () => {
            const res = await ensureProjectFolderAction(project.id);
            if (!res.ok) toast.error(res.error);
            return res.ok ? res.data : null;
          }}
        />
      )}

      {/* Las acciones ya revalidan la ficha: un router.refresh() extra la volvía a armar entera (doble consulta). */}
      <ProjectFormDialog project={project} open={editing} onOpenChange={setEditing} onSaved={() => undefined} />
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
          onSaved={() => undefined}
        />
      )}
    </div>
  );
}

/** Resumen: la información general y, con Contratistas, la plata de sus contratos. */
function Overview({
  project,
  people: links,
  canContracts,
  contracts,
  onOpenContracts,
}: {
  project: Project;
  people: { designer: string | null; client: string | null };
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
      <ProfileCard icon={Info} title={tt("info_title")}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
          <Item label={tt("f_location")} value={projectAddress(project) || tt("none")} />
          {project.designerId || project.clientId ? (
            <>
              <Item label={tt("f_designer")} value={links.designer || tt("none")} />
              <Item label={tt("f_end_client")} value={links.client || tt("none")} />
            </>
          ) : (
            <Item label={tt("f_client")} value={project.clientName || tt("none")} />
          )}
          <Item label={tt("f_created")} value={formatDateCompact(lang, todayInPanama(new Date(project.createdAt)))} />
          {project.notes && (
            <div className="col-span-2 lg:col-span-4">
              <Item label={tt("f_notes")} value={project.notes} />
            </div>
          )}
        </dl>
      </ProfileCard>

      {canContracts && (
        <ProfileCard
          icon={ICON.contract}
          title={tt("money_title")}
          action={
            <Button size="sm" variant="outline" onClick={onOpenContracts}>
              {tt("see_contracts")}
              <ChevronRight className="size-3.5" />
            </Button>
          }
        >
          {contracts.length === 0 ? (
            <EmptyState>{tt("no_contracts")}</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <KpiCard
                  icon={ICON.contract}
                  tone="primary"
                  label={tt("kpi_contracts")}
                  value={String(contracts.length)}
                  sublabel={totals.active === 1 ? tt("contracts_active_1") : tt("contracts_active").replace("{n}", String(totals.active))}
                />
                <KpiCard icon={Handshake} label={tt("kpi_value")} value={formatCents(totals.value)} />
                <KpiCard icon={Banknote} tone="positive" label={tt("kpi_paid")} value={formatCents(totals.paid)} />
                <KpiCard
                  icon={Hourglass}
                  tone={totals.pending > 0 ? "warning" : "neutral"}
                  label={tt("kpi_pending")}
                  value={formatCents(totals.pending)}
                  sublabel={totals.retained > 0 ? `${tt("kpi_retained")} ${formatCents(totals.retained)}` : undefined}
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
        </ProfileCard>
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
  const sorted = React.useMemo(() => sortContracts(contracts), [contracts]);
  const active = sorted.filter((c) => c.status === "ACTIVE");
  const completed = sorted.filter((c) => c.status !== "ACTIVE");
  // Si ya no queda ninguno activo, los terminados se ven de entrada (si no, la pestaña quedaría vacía).
  const [showCompleted, setShowCompleted] = React.useState(active.length === 0);
  // Si se termina el último activo con la ficha abierta, los terminados se muestran solos.
  const noneActive = active.length === 0;
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- solo abre; nunca pisa lo que la persona eligió mientras hay activos.
    if (noneActive) setShowCompleted(true);
  }, [noneActive]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-3.5" />
          {tt("add_contract")}
        </Button>
      </div>
      {contracts.length === 0 ? (
        <EmptyState>{tt("no_contracts")}</EmptyState>
      ) : (
        <>
          {active.length > 0 && <ContractsTable contracts={active} onOpen={onOpen} showContractor showProject={false} />}
          {completed.length > 0 && (
            <div className="flex flex-col gap-3">
              <ShowToggle
                checked={showCompleted}
                onChange={setShowCompleted}
                label={tt("show_completed").replace("{n}", String(completed.length))}
                className="self-start"
              />
              {showCompleted && <ContractsTable contracts={completed} onOpen={onOpen} showContractor showProject={false} />}
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
