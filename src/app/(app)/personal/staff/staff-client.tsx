"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Download, Hammer, IdCard, Loader2, Phone, Plus, Users, X } from "lucide-react";

import type { PayrollEmployee, PayrollPosition } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
import type { DirectoryPerson } from "@/types/staff-directory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { breadcrumbFor } from "@/components/layout/nav-items";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDateCompact } from "@/lib/planilla/format";
import { filterTeam, type TeamFilter, type TeamMember } from "@/lib/personal/team";
import { EmployeeAvatar } from "../../planilla/employee-avatar";
import { EmployeePhotosProvider } from "../../planilla/employee-photos-context";
import { EmployeeSearchInput } from "../../planilla/employee-search-input";
import { EmployeeFormDialog } from "../../planilla/employee-form-dialog";
import { StaffRosterExport } from "./staff-roster-export";
import { IntakeInbox } from "./intake-inbox";
import type { StaffIntake } from "@/types/staff-intake";
import type { MatchCandidate } from "@/lib/personal/jotform-intake";
import { ContractorAvatar } from "../../contratistas/contractor-avatar";
import { ContractorFormDialog } from "../../contratistas/contractor-form-dialog";
import { downloadStaffDocuments } from "./download-documents";

/**
 * Personal → Staff: empleados y contratistas en una sola lista, con
 * buscador y filtro por tipo. Es EL lugar del staff: desde acá se agrega a
 * alguien (empleado o contratista, según los módulos del usuario) y cada
 * fila abre su ficha (`/personal/staff/...`), donde se edita. Los que ya no
 * laboran van aparte, plegados. Arriba, si hay, los "Nuevos registros" que
 * llegaron del formulario de JotForm (ver intake-inbox.tsx). "Descargar PDF" baja la lista (todos, solo
 * empleados o solo contratistas) con su ficha, para imprimir.
 *
 * Con solo el permiso Personal es de lectura: sin agregar, sin registros de
 * JotForm y sin exportar el listado. "Descargar documentos" (para todos)
 * pone casillas en la lista y baja las cédulas marcadas en un solo PDF.
 */
export function StaffClient({
  members,
  people,
  employees,
  contractors,
  intakes,
  candidates,
  positions,
  photoUrls,
  contractorPhotoUrls,
  canEmployees,
  canContractors,
}: {
  members: TeamMember[];
  /** Cada persona sin dinero, con su documento (para descargarlos). */
  people: DirectoryPerson[];
  /** Fichas completas (para el PDF); vacías sin el módulo correspondiente. */
  employees: PayrollEmployee[];
  contractors: Contractor[];
  /** Registros del formulario de JotForm por revisar. */
  intakes: StaffIntake[];
  candidates: MatchCandidate[];
  /** Catálogo de posiciones, para el formulario de empleado nuevo. */
  positions: PayrollPosition[];
  /** Fotos de empleados (las lee EmployeeAvatar vía EmployeePhotosProvider). */
  photoUrls: Record<string, string>;
  contractorPhotoUrls: Record<string, string>;
  canEmployees: boolean;
  canContractors: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname, lang);

  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<TeamFilter>("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = React.useState(false);
  const [addContractorOpen, setAddContractorOpen] = React.useState(false);
  const showKindFilter = members.some((m) => m.kind === "employee") && members.some((m) => m.kind === "contractor");
  const canEdit = canEmployees || canContractors;

  // "Descargar documentos": modo con casillas.
  const td = (k: keyof typeof strings.documentos) => t(lang, strings.documentos[k]);
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [downloading, setDownloading] = React.useState(false);
  const memberKey = (m: { kind: string; id: string }) => `${m.kind}:${m.id}`;
  const personByKey = React.useMemo(() => new Map(people.map((p) => [memberKey(p), p])), [people]);
  const hasDocument = (m: TeamMember) => !!personByKey.get(memberKey(m))?.documentUrl;
  const toggleSelected = (m: TeamMember) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(memberKey(m))) next.delete(memberKey(m));
      else next.add(memberKey(m));
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  async function downloadDocuments() {
    const chosen = [...selected].map((k) => personByKey.get(k)).filter((p): p is DirectoryPerson => !!p);
    setDownloading(true);
    try {
      const { included, missing } = await downloadStaffDocuments(chosen, {
        fileName: td("file_name"),
        cedula: td("type_cedula"),
        pasaporte: td("type_pasaporte"),
      });
      if (included > 0) toast.success(td("downloaded"));
      if (missing.length > 0) toast(`${td("missing_docs")} ${missing.join(", ")}`, { duration: 8000 });
      if (included > 0) stopSelecting();
    } catch (err) {
      console.error("Staff: no se pudo armar el PDF de documentos", err);
      toast.error(td("download_failed"));
    } finally {
      setDownloading(false);
    }
  }
  const selection = selecting ? { selected, isSelected: (m: TeamMember) => selected.has(memberKey(m)), onToggle: toggleSelected, hasDocument } : undefined;

  const visible = filterTeam(members, { kind, query });
  const active = visible.filter((m) => m.active);
  const inactive = visible.filter((m) => !m.active);
  const activeTotal = members.filter((m) => m.active).length;

  const FILTERS: { value: TeamFilter; label: string }[] = [
    { value: "all", label: tt("filter_all") },
    { value: "employee", label: tt("filter_employee") },
    { value: "contractor", label: tt("filter_contractor") },
  ];

  return (
    <EmployeePhotosProvider photoUrls={photoUrls}>
      <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
        {crumbs.length > 0 && (
          <nav aria-label="breadcrumb" className="-mt-2 flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={crumb} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/60">/</span>}
                  <span className={isLast ? "font-semibold text-foreground" : "text-muted-foreground"}>{crumb}</span>
                </span>
              );
            })}
          </nav>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {tt("title")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {activeTotal} {tt("active_count")}
              </span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tt("subtitle")}</p>
          </div>
          {!canEdit ? null : canEmployees && canContractors ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="size-3.5" />
                  {tt("add")}
                  <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setAddEmployeeOpen(true)}>
                  <Users className="size-3.5" />
                  {tt("add_employee")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAddContractorOpen(true)}>
                  <Hammer className="size-3.5" />
                  {tt("add_contractor")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => (canEmployees ? setAddEmployeeOpen(true) : setAddContractorOpen(true))}>
              <Plus className="size-3.5" />
              {tt(canEmployees ? "add_employee" : "add_contractor")}
            </Button>
          )}
        </div>

        {canEdit && (
          <IntakeInbox
            intakes={intakes}
            candidates={candidates}
            positions={positions}
            canEmployees={canEmployees}
            canContractors={canContractors}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <EmployeeSearchInput value={query} onChange={setQuery} placeholder={tt("search")} className="w-full max-w-xs" />
          {showKindFilter && (
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-[3px]">
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-[12.5px] transition-colors",
                    kind === value ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant={selecting ? "secondary" : "outline"} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
              {selecting ? <X className="size-3.5" /> : <IdCard className="size-3.5" />}
              {selecting ? td("cancel_select") : td("download")}
            </Button>
            {canEdit && (
              <StaffRosterExport
                employees={employees}
                contractors={contractors}
                canEmployees={canEmployees}
                canContractors={canContractors}
              />
            )}
          </div>
        </div>

        {selecting && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{td("select_hint")}</span>
            <span className="font-medium text-foreground">
              {selected.size} {td("selected_count")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() =>
                setSelected((cur) => new Set([...cur, ...visible.filter((m) => m.active && hasDocument(m)).map(memberKey)]))
              }
            >
              {td("select_visible")}
            </Button>
            <Button size="sm" className="ml-auto" disabled={selected.size === 0 || downloading} onClick={() => void downloadDocuments()}>
              {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              {downloading ? td("downloading") : td("download_pdf")}
            </Button>
          </div>
        )}

        {members.length === 0 ? (
          <EmptyBox>{tt("empty")}</EmptyBox>
        ) : visible.length === 0 ? (
          <EmptyBox>{tt("no_results")}</EmptyBox>
        ) : (
          <>
            {active.length > 0 && <TeamList members={active} contractorPhotoUrls={contractorPhotoUrls} selection={selection} />}

            {inactive.length > 0 && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {showInactive ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  {tt("inactive_section")} ({inactive.length})
                </button>
                {showInactive && <TeamList members={inactive} contractorPhotoUrls={contractorPhotoUrls} selection={selection} muted />}
              </div>
            )}
          </>
        )}
      </div>

      {canEmployees && (
        <EmployeeFormDialog mode="add" positions={positions} open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen} />
      )}
      {canContractors && <ContractorFormDialog open={addContractorOpen} onOpenChange={setAddContractorOpen} />}
    </EmployeePhotosProvider>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const GRID = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_20px]";

interface TeamSelection {
  isSelected: (m: TeamMember) => boolean;
  onToggle: (m: TeamMember) => void;
  hasDocument: (m: TeamMember) => boolean;
}

function TeamList({
  members,
  contractorPhotoUrls,
  selection,
  muted = false,
}: {
  members: TeamMember[];
  contractorPhotoUrls: Record<string, string>;
  /** En "Descargar documentos": cada fila marca/desmarca en vez de abrir la ficha. */
  selection?: TeamSelection;
  muted?: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const tdoc = (k: keyof typeof strings.documentos) => t(lang, strings.documentos[k]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", muted && "opacity-70")}>
      {/* Encabezado: solo en pantallas anchas; en el celular cada persona es una tarjeta. */}
      <div className={cn("hidden gap-4 border-b border-border px-4 py-2.5 text-xs text-muted-foreground md:grid", GRID)}>
        <span>{tt("col_person")}</span>
        <span>{tt("col_type")}</span>
        <span>{tt("col_department")}</span>
        <span>{tt("col_position")}</span>
        <span>{tt("col_since")}</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={`${m.kind}-${m.id}`}>
            <Link
              href={m.href}
              onClick={
                selection
                  ? (e) => {
                      e.preventDefault();
                      selection.onToggle(m);
                    }
                  : undefined
              }
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-muted/50",
                GRID
              )}
            >
              <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
                {selection && (
                  <input
                    type="checkbox"
                    readOnly
                    tabIndex={-1}
                    aria-label={m.name}
                    checked={selection.isSelected(m)}
                    className="size-4 shrink-0"
                  />
                )}
                {m.kind === "employee" ? (
                  <EmployeeAvatar name={m.name} employeeId={m.id} sortOrder={m.sortOrder} size="md" />
                ) : (
                  <ContractorAvatar name={m.name} photoUrl={contractorPhotoUrls[m.id] ?? null} size="md" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{m.name}</div>
                  {selection && !selection.hasDocument(m) ? (
                    <div className="truncate text-xs text-muted-foreground/70">{tdoc("no_document")}</div>
                  ) : (
                    m.phone && (
                      <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Phone className="size-3 shrink-0" />
                        {m.phone}
                      </div>
                    )
                  )}
                </div>
              </div>

              <ChevronRight className="col-start-2 row-start-1 size-4 text-muted-foreground md:col-start-6" />

              {/* En el celular, tipo · departamento · puesto van en una sola línea bajo el nombre. */}
              <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:contents">
                <div className="md:col-start-2 md:row-start-1">
                  <Badge variant={m.kind === "employee" ? "secondary" : "outline"}>
                    {tt(m.kind === "employee" ? "kind_employee" : "kind_contractor")}
                  </Badge>
                </div>
                <div className="text-sm text-foreground md:col-start-3 md:row-start-1">{tt(`dept_${m.department}`)}</div>
                <div className="min-w-0 truncate text-sm text-muted-foreground md:col-start-4 md:row-start-1 md:text-foreground">
                  {/* Los contratistas no tienen puesto: va su oficio (Ebanista / Pintor). */}
                  {m.position ?? (m.kind === "contractor" ? tt(`group_${m.group}`) : "—")}
                </div>
              </div>

              <div
                className={cn(
                  "col-span-2 text-xs text-muted-foreground md:col-span-1 md:col-start-5 md:row-start-1",
                  !m.startDate && "hidden md:block"
                )}
              >
                {m.startDate ? (
                  <>
                    {/* En el celular no hay encabezado de columna: la fecha lleva su etiqueta. */}
                    <span className="md:hidden">{tt("col_since")} </span>
                    {formatDateCompact(lang, m.startDate)}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
