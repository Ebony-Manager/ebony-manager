"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Hammer, LayoutList, Phone, Plus, Table2, Users } from "lucide-react";

import type { PayrollEmployee, PayrollPosition } from "@/types/planilla";
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
import { formatCents } from "@/lib/planilla/payroll-period";
import { matchesEmployeeQuery } from "@/lib/planilla/employee-search";
import { balanceTone, toneTextStyle } from "@/lib/contractors/contractor-colors";
import { filterTeam, type TeamFilter, type TeamMember } from "@/lib/personal/team";
import { EmployeeAvatar } from "../../planilla/employee-avatar";
import { EmployeePhotosProvider } from "../../planilla/employee-photos-context";
import { EmployeeSearchInput } from "../../planilla/employee-search-input";
import { EmployeeFormDialog } from "../../planilla/employee-form-dialog";
import { EmployeeRosterTable } from "../../planilla/employee-roster-table";
import { ContractorAvatar } from "../../contratistas/contractor-avatar";
import { ContractorFormDialog } from "../../contratistas/contractor-form-dialog";

/**
 * Personal → Staff: empleados y contratistas en una sola lista, con
 * buscador y filtro por tipo. Es EL lugar del staff: desde acá se agrega a
 * alguien (empleado o contratista, según los módulos del usuario) y cada
 * fila abre su ficha (`/personal/staff/...`), donde se edita. Los que ya no
 * laboran van aparte, plegados. La vista "Tabla de empleados" es la ficha
 * de todos los empleados de una vez, para ver o bajar en PDF.
 */
export function StaffClient({
  members,
  employees,
  positions,
  photoUrls,
  contractorPhotoUrls,
  canEmployees,
  canContractors,
}: {
  members: TeamMember[];
  /** Empleados completos (para la tabla y su PDF); vacío sin el módulo Planilla. */
  employees: PayrollEmployee[];
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
  const [view, setView] = React.useState<"list" | "table">("list");
  const [addEmployeeOpen, setAddEmployeeOpen] = React.useState(false);
  const [addContractorOpen, setAddContractorOpen] = React.useState(false);
  const showKindFilter = canEmployees && canContractors;

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
          {canEmployees && canContractors ? (
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

        <div className="flex flex-wrap items-center gap-3">
          <EmployeeSearchInput value={query} onChange={setQuery} placeholder={tt("search")} className="w-full max-w-xs" />
          {showKindFilter && view === "list" && (
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
          {canEmployees && (
            <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border bg-card p-[3px]">
              {(
                [
                  { key: "list", icon: LayoutList, label: tt("view_list") },
                  { key: "table", icon: Table2, label: tt("view_table") },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] transition-colors",
                    view === key ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === "table" ? (
          <EmployeeRosterTable employees={employees.filter((e) => matchesEmployeeQuery(e.name, query))} />
        ) : members.length === 0 ? (
          <EmptyBox>{tt("empty")}</EmptyBox>
        ) : visible.length === 0 ? (
          <EmptyBox>{tt("no_results")}</EmptyBox>
        ) : (
          <>
            {active.length > 0 && <TeamList members={active} contractorPhotoUrls={contractorPhotoUrls} />}

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
                {showInactive && <TeamList members={inactive} contractorPhotoUrls={contractorPhotoUrls} muted />}
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

const GRID = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_20px]";

function TeamList({
  members,
  contractorPhotoUrls,
  muted = false,
}: {
  members: TeamMember[];
  contractorPhotoUrls: Record<string, string>;
  muted?: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", muted && "opacity-70")}>
      {/* Encabezado: solo en pantallas anchas; en el celular cada persona es una tarjeta. */}
      <div className={cn("hidden gap-4 border-b border-border px-4 py-2.5 text-xs text-muted-foreground md:grid", GRID)}>
        <span>{tt("col_person")}</span>
        <span>{tt("col_type")}</span>
        <span>{tt("col_position")}</span>
        <span>{tt("col_since")}</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={`${m.kind}-${m.id}`}>
            <Link
              href={m.href}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-muted/50",
                GRID
              )}
            >
              <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
                {m.kind === "employee" ? (
                  <EmployeeAvatar name={m.name} employeeId={m.id} sortOrder={m.sortOrder} size="md" />
                ) : (
                  <ContractorAvatar name={m.name} photoUrl={contractorPhotoUrls[m.id] ?? null} size="md" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{m.name}</div>
                  {m.phone && (
                    <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      {m.phone}
                    </div>
                  )}
                </div>
              </div>

              <ChevronRight className="col-start-2 row-start-1 size-4 text-muted-foreground md:col-start-5" />

              <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:col-start-2 md:row-start-1">
                <Badge variant={m.kind === "employee" ? "secondary" : "outline"}>
                  {tt(m.kind === "employee" ? "kind_employee" : "kind_contractor")}
                </Badge>
                <span className="text-xs text-muted-foreground">{tt(`group_${m.group}`)}</span>
              </div>

              {/* Puesto del empleado, o el saldo del contratista con Ebony. Sin
                  dato: "—" en la columna de escritorio; en el celular la línea no aparece. */}
              <div
                className={cn(
                  "col-span-2 truncate text-sm text-foreground md:col-span-1 md:col-start-3 md:row-start-1",
                  !m.position && !m.balanceCents && "hidden md:block"
                )}
              >
                {m.position ?? (m.balanceCents ? <ContractorBalance cents={m.balanceCents} /> : <span className="text-muted-foreground">—</span>)}
              </div>

              <div
                className={cn(
                  "col-span-2 text-xs text-muted-foreground md:col-span-1 md:col-start-4 md:row-start-1",
                  !m.startDate && "hidden md:block"
                )}
              >
                {m.startDate ? formatDateCompact(lang, m.startDate) : "—"}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Saldo del contratista: verde si Ebony le debe, rojo si él le debe a Ebony. */
function ContractorBalance({ cents }: { cents: number }) {
  const { lang } = useLang();
  const tone = balanceTone(cents);
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-semibold tabular-nums" style={toneTextStyle(tone)}>
        {formatCents(Math.abs(cents))}
      </span>
      <span className="text-xs text-muted-foreground">
        {t(lang, strings.staff[tone === "a_favor" ? "balance_ebony_owes" : "balance_owes_ebony"])}
      </span>
    </span>
  );
}
