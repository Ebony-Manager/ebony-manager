"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Hammer,
  IdCard,
  LogOut,
  Package,
  Palette,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Settings,
  Trash2,
  UserCheck,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

import type { Contractor, ContractorLedgerEntry, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { formatDate, formatDateCompact } from "@/lib/planilla/format";
// KPIs con el mismo componente que el Registro de Planilla (Taller) —
// Contratistas es módulo hermano de Planilla y ya reutiliza su capa de
// formato; reusar la tarjeta mantiene el estilo idéntico.
import { PayrollKpiCard } from "@/app/(app)/planilla/payroll-kpi-card";
import {
  CONTRACTOR_LEDGER_CATEGORIES,
  contractorBalanceCents,
  withRunningBalance,
} from "@/lib/contractors/contractor-ledger";
import {
  balanceTone,
  categoryDotStyle,
  categoryRowStyle,
  categoryTextStyle,
  toneTextStyle,
  toneVar,
  type LedgerPalette,
} from "@/lib/contractors/contractor-colors";
import {
  calendarWindow,
  isCalendarView,
  LAST_N_MOVEMENTS,
  LEDGER_PERIOD_VIEWS,
  shiftAnchor,
  windowLabel,
  type LedgerPeriodView,
} from "@/lib/contractors/contractor-period";
import {
  groupLedgerRows,
  ledgerRowsTotals,
  LEDGER_GROUP_BYS,
  type LedgerGroupBy,
} from "@/lib/contractors/contractor-ledger-view";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  deleteLedgerEntryAction,
  getContractorLedgerAction,
  getProjectsAction,
  updateContractorAction,
} from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { ContractorAvatar } from "./contractor-avatar";
import { LedgerEntryDialog } from "./ledger-entry-dialog";
import { ContractorLiquidationDialog } from "./contractor-liquidation-dialog";
import { DeleteContractorDialog } from "./delete-contractor-dialog";

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

const PERIOD_VIEW_LABEL_KEY: Record<LedgerPeriodView, keyof typeof strings.contratistas> = {
  month: "period_month",
  quarter: "period_quarter",
  semester: "period_semester",
  year: "period_year",
  last15: "period_last15",
  all: "period_all",
};

const GROUP_BY_LABEL_KEY: Record<LedgerGroupBy, keyof typeof strings.contratistas> = {
  none: "group_none",
  category: "group_category",
  project: "group_project",
  month: "group_month",
};

const CAT_ALL = "all";
const PROJ_ALL = "all";
const PROJ_NONE = "__none__";

// La elección de paleta ("full" / "sober") se recuerda por navegador.
const PALETTE_STORAGE_KEY = "contratistas:ledger-palette";
function readStoredPalette(): LedgerPalette | null {
  try {
    const v = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return v === "full" || v === "sober" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Ficha del contratista A PANTALLA COMPLETA (`/contratistas/[id]`):
 * encabezado + saldo, KPIs, estado de cuenta y — al final — las acciones
 * de estado (inactivar / liquidar / reactivar / borrar), mismo patrón
 * que la ficha de Taller.
 *
 * SALDO: el saldo corrido de cada fila se calcula SIEMPRE sobre la
 * historia completa (`withRunningBalance`) y NUNCA se reinicia. El
 * período, los filtros y el "agrupar por" solo cambian QUÉ filas se ven
 * — cada fila visible sigue mostrando su saldo real acumulado (igual que
 * la columna de saldo del Excel del dueño).
 *
 * COLOR DE FILA: en la paleta "full" (por defecto) la fila entera toma el
 * color de su CATEGORÍA (Proyecto gris, Material azul, Pago verde,
 * Préstamo amarillo, resto neutro). En "sober" las filas van neutras y la
 * categoría se marca con un puntito + el proyecto en negrita. El
 * interruptor recuerda la elección en localStorage. El sentido
 * ingreso/egreso se lee siempre en las columnas "A favor" / "Reduce".
 */
export function ContractorProfileView({
  contractor,
  initialEntries,
  initialProjects,
}: {
  contractor: Contractor;
  initialEntries: ContractorLedgerEntry[];
  initialProjects: Project[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [entries, setEntries] = React.useState<ContractorLedgerEntry[]>(initialEntries);
  const [projects, setProjects] = React.useState<Project[]>(initialProjects);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorLedgerEntry | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const [liqOpen, setLiqOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reactivating, setReactivating] = React.useState(false);

  // Vista de período — "Mes" por defecto. El ancla arranca en el mes del
  // último movimiento (o el mes actual si no hay ninguno).
  const [periodView, setPeriodView] = React.useState<LedgerPeriodView>("month");
  const [anchor, setAnchor] = React.useState(() => {
    const last = initialEntries[initialEntries.length - 1];
    const d = last ? last.entryDate : new Date().toISOString().slice(0, 10);
    const [year, month] = d.split("-").map(Number);
    return { year, month };
  });

  // Filtros y agrupación (conviven con el período; no tocan el saldo).
  const [catFilter, setCatFilter] = React.useState<string>(CAT_ALL);
  const [projFilter, setProjFilter] = React.useState<string>(PROJ_ALL);
  const [groupBy, setGroupBy] = React.useState<LedgerGroupBy>("none");

  // Paleta de la tabla: "full" (fila a todo color, por defecto) o "sober"
  // (neutra). Arranca en "full" para que el server y el primer render del
  // cliente coincidan; la preferencia guardada se aplica tras hidratar.
  const [palette, setPalette] = React.useState<LedgerPalette>("full");
  const sober = palette === "sober";
  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    const stored = readStoredPalette();
    if (stored) setPalette(stored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    } catch {
      /* ignore */
    }
  }, [palette]);

  const contractorId = contractor.id;

  const load = React.useCallback(() => {
    getContractorLedgerAction(contractorId).then(setEntries);
  }, [contractorId]);

  const reloadProjects = React.useCallback(() => {
    getProjectsAction().then(setProjects);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza el estado local con las props del server. */
  React.useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);
  React.useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Saldo corrido sobre la HISTORIA COMPLETA — nunca por período/filtro.
  const allRows = React.useMemo(() => withRunningBalance(entries), [entries]);
  const balanceCents = contractorBalanceCents(entries);
  const balTone = balanceTone(balanceCents);

  // KPIs — totales de toda la historia del contratista.
  const kpis = React.useMemo(() => {
    let billed = 0;
    let paid = 0;
    let materials = 0;
    let projectCount = 0;
    for (const e of entries) {
      if (e.category === "trabajo") {
        projectCount += 1;
        if (e.direction === "a_favor") billed += e.amountCents;
      } else if (e.category === "pago") {
        paid += e.amountCents;
      } else if (e.category === "material") {
        materials += e.amountCents;
      }
    }
    return { billed, paid, materials, projectCount };
  }, [entries]);

  // Filas visibles: período → filtros → agrupación. `allRows` ya trae el
  // saldo real acumulado en cada fila; acá solo se esconden filas.
  const periodRows = React.useMemo(() => {
    if (periodView === "all") return allRows;
    if (periodView === "last15") return allRows.slice(-LAST_N_MOVEMENTS);
    const { startISO, endISO } = calendarWindow(periodView, anchor.year, anchor.month);
    return allRows.filter((r) => r.entryDate >= startISO && r.entryDate <= endISO);
  }, [allRows, periodView, anchor]);

  const filteredRows = React.useMemo(() => {
    return periodRows.filter((r) => {
      if (catFilter !== CAT_ALL && r.category !== catFilter) return false;
      if (projFilter === PROJ_NONE && r.projectId !== null) return false;
      if (projFilter !== PROJ_ALL && projFilter !== PROJ_NONE && r.projectId !== projFilter) return false;
      return true;
    });
  }, [periodRows, catFilter, projFilter]);

  const groups = React.useMemo(() => groupLedgerRows(filteredRows, groupBy), [filteredRows, groupBy]);

  // Total de lo que queda VISIBLE tras filtrar (período + categoría +
  // proyecto). Distinto del saldo corrido: es solo la suma del conjunto
  // filtrado, y se recalcula al cambiar cualquier filtro.
  const filteredTotals = React.useMemo(() => ledgerRowsTotals(filteredRows), [filteredRows]);

  const projectName = React.useCallback(
    (id: string) => projects.find((p) => p.id === id)?.name ?? id,
    [projects]
  );

  function groupHeading(key: string): string {
    if (groupBy === "category") {
      return t(
        lang,
        strings.contratistas[CONTRACTOR_CATEGORY_LABEL_KEY[key as keyof typeof CONTRACTOR_CATEGORY_LABEL_KEY] as keyof typeof strings.contratistas]
      );
    }
    if (groupBy === "project") return key === "" ? tt("no_project") : projectName(key);
    if (groupBy === "month") {
      const [y, m] = key.split("-").map(Number);
      return `${monthLabel(lang, m)} ${y}`;
    }
    return "";
  }

  async function handleDeleteEntry(id: string) {
    if (!window.confirm(tt("mov_delete_confirm"))) return;
    setDeletingId(id);
    try {
      await deleteLedgerEntryAction(id);
      load();
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReactivate() {
    setReactivating(true);
    try {
      await updateContractorAction(contractor.id, { status: "ACTIVE", endDate: null });
      toast.success(tt("reactivate_done"));
      router.refresh();
    } finally {
      setReactivating(false);
    }
  }

  const label = (key: string) =>
    t(lang, strings.contratistas[key as keyof typeof strings.contratistas]);

  const typeLabel =
    contractor.contractorType === "pintor" ? tt("type_pintor") : tt("type_ebanista");
  const balDescription =
    balTone === "a_favor"
      ? tt("bal_ebony_owes")
      : balTone === "reduce"
        ? tt("bal_owes_ebony")
        : tt("bal_settled");
  const isInactive = contractor.status === "INACTIVE";
  const totalColSpan = 10;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/contratistas">
              <ArrowLeft className="size-3.5" />
              {tt("back_to_directory")}
            </Link>
          </Button>

          {/* Ajustes del contratista: inactivar / liquidar / reactivar /
              eliminar viven acá, no sueltos en la ficha. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={tt("settings_menu")}
                title={tt("settings_menu")}
              >
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {tt("status_label")}:{" "}
                <span className="font-medium text-foreground">
                  {isInactive ? tt("status_inactive") : tt("status_active")}
                </span>
                {contractor.endDate && (
                  <>
                    {" · "}
                    {tt("end_date_label")}: {formatDate(lang, contractor.endDate)}
                  </>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.setTimeout(() => setLiqOpen(true), 0)}>
                <LogOut className="size-3.5" />
                {isInactive ? tt("liq_edit") : tt("liq_mark")}
              </DropdownMenuItem>
              {isInactive && (
                <DropdownMenuItem disabled={reactivating} onSelect={() => handleReactivate()}>
                  <UserCheck className="size-3.5" />
                  {tt("reactivate")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => window.setTimeout(() => setDeleteOpen(true), 0)}
              >
                <Trash2 className="size-3.5" />
                {tt("delete_contractor")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ContractorAvatar name={contractor.name} size="md" />
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                {contractor.name}
                {isInactive && <Badge variant="secondary">{tt("inactive_badge")}</Badge>}
              </h1>
              <p className="text-sm text-muted-foreground">{typeLabel}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">{tt("balance_label")}</p>
            <p className="text-2xl font-semibold tabular-nums" style={toneTextStyle(balTone)}>
              {formatCents(balanceCents)}
            </p>
            <p className="text-xs text-muted-foreground">{balDescription}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProfileField
          label={tt("f_id_document")}
          value={
            contractor.idDocument ? (
              <span className="inline-flex items-center gap-1">
                <IdCard className="size-3.5" />
                {contractor.idDocument}
              </span>
            ) : null
          }
        />
        <ProfileField
          label={tt("f_phone")}
          value={
            contractor.phone ? (
              <a
                href={`tel:${contractor.phone}`}
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <Phone className="size-3.5" />
                {contractor.phone}
              </a>
            ) : null
          }
        />
        <ProfileField label={tt("f_contact")} value={contractor.contactInfo} />
        <ProfileField
          label={isInactive ? tt("end_date_label") : tt("f_start_date")}
          value={
            isInactive
              ? contractor.endDate
                ? formatDate(lang, contractor.endDate)
                : null
              : contractor.startDate
                ? formatDate(lang, contractor.startDate)
                : null
          }
        />
      </div>

      {contractor.notes && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {contractor.notes}
        </div>
      )}

      {/* KPIs del contratista — estilo consistente con Planilla (Taller). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <PayrollKpiCard
          icon={Wallet}
          label={tt("kpi_balance")}
          value={formatCents(balanceCents)}
          sublabel={balDescription}
          color={toneVar(balTone)}
        />
        <PayrollKpiCard
          icon={Receipt}
          label={tt("kpi_billed")}
          value={formatCents(kpis.billed)}
          color="var(--ebony-gold)"
        />
        <PayrollKpiCard
          icon={Hammer}
          label={tt("kpi_projects")}
          value={String(kpis.projectCount)}
          sublabel={tt("kpi_projects_count")}
          color="var(--contractor-cat-proyecto)"
        />
        <PayrollKpiCard
          icon={Banknote}
          label={tt("kpi_paid")}
          value={formatCents(kpis.paid)}
          color="var(--contractor-cat-pago)"
        />
        <PayrollKpiCard
          icon={Package}
          label={tt("kpi_materials")}
          value={formatCents(kpis.materials)}
          color="var(--contractor-cat-material)"
        />
      </div>

      {/* Estado de cuenta */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">{tt("ledger_title")}</h2>
            <p className="text-xs text-muted-foreground">
              {tt("balance_label")}:{" "}
              <span className="font-medium tabular-nums" style={toneTextStyle(balTone)}>
                {formatCents(balanceCents)}
              </span>
              {" · "}
              {balDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isCalendarView(periodView) && (
              <div className="flex items-center gap-1 rounded-md border border-border px-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={tt("period_prev")}
                  onClick={() => setAnchor((a) => shiftAnchor(periodView, a.year, a.month, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-32 text-center text-sm font-medium text-foreground">
                  {windowLabel(lang, periodView, anchor.year, anchor.month)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={tt("period_next")}
                  onClick={() => setAnchor((a) => shiftAnchor(periodView, a.year, a.month, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            <Select value={periodView} onValueChange={(v) => setPeriodView(v as LedgerPeriodView)}>
              <SelectTrigger className="h-9 w-[190px] text-sm" aria-label={tt("period_label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEDGER_PERIOD_VIEWS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {tt(PERIOD_VIEW_LABEL_KEY[v])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              {tt("ledger_add")}
            </Button>
          </div>
        </div>

        {/* Filtros + agrupar por */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-8 w-[190px] text-xs" aria-label={tt("filter_category")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CAT_ALL}>{tt("filter_category_all")}</SelectItem>
              {CONTRACTOR_LEDGER_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {label(CONTRACTOR_CATEGORY_LABEL_KEY[c])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projFilter} onValueChange={setProjFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs" aria-label={tt("filter_project")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROJ_ALL}>{tt("filter_project_all")}</SelectItem>
              <SelectItem value={PROJ_NONE}>{tt("filter_project_none")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as LedgerGroupBy)}>
            <SelectTrigger className="h-8 w-[170px] text-xs" aria-label={tt("group_by")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEDGER_GROUP_BYS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g === "none" ? tt("group_none") : `${tt("group_by")}: ${tt(GROUP_BY_LABEL_KEY[g])}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Interruptor de paleta: fila a todo color ⇄ vista sobria.
              La elección se persiste en localStorage. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 text-xs"
            aria-label={tt("palette_label")}
            title={tt("palette_toggle_hint")}
            onClick={() => setPalette((p) => (p === "full" ? "sober" : "full"))}
          >
            <Palette className="size-3.5" />
            {sober ? tt("palette_sober") : tt("palette_full")}
          </Button>
        </div>

        {/* Total de lo filtrado — suma de lo VISIBLE (no el saldo corrido). */}
        {filteredRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/30 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">
              {tt("filtered_total")} · {filteredRows.length}{" "}
              {filteredRows.length === 1 ? tt("filtered_count_one") : tt("filtered_count_many")}
            </span>
            <span className="text-muted-foreground">
              {tt("col_a_favor")}:{" "}
              <span className="font-medium tabular-nums" style={toneTextStyle("a_favor")}>
                {formatCents(filteredTotals.aFavorCents)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {tt("col_reduce")}:{" "}
              <span className="font-medium tabular-nums" style={toneTextStyle("reduce")}>
                {formatCents(filteredTotals.reduceCents)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {tt("filtered_net")}:{" "}
              <span
                className="font-semibold tabular-nums"
                style={toneTextStyle(balanceTone(filteredTotals.netCents))}
              >
                {formatCents(filteredTotals.netCents)}
              </span>
            </span>
          </div>
        )}

        {allRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {tt("ledger_empty")}
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {periodRows.length === 0 ? tt("period_empty") : tt("no_results")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1150px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  {/* Columna "Fecha" congelada al hacer scroll horizontal,
                      igual que "Empleado" en el Registro de Planilla. */}
                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
                    {tt("col_date")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_category")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_project")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_description")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_mt2")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_cost_mt2")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_a_favor")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_reduce")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_balance")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>

              {groups.map((g) => (
                <tbody key={g.key || "__all__"}>
                  {groupBy !== "none" && (
                    <tr className="border-b border-border bg-muted/30">
                      <td colSpan={totalColSpan} className="px-3 py-1.5 text-xs font-semibold text-foreground">
                        {groupHeading(g.key)}{" "}
                        <span className="font-normal text-muted-foreground">· {g.rows.length}</span>
                      </td>
                    </tr>
                  )}

                  {g.rows.map((row) => {
                    const absorbed = row.ebonyAbsorbsMaterial;
                    const hovered = hoveredId === row.id;
                    const catText = label(CONTRACTOR_CATEGORY_LABEL_KEY[row.category]);
                    const catDot = categoryDotStyle(row.category);
                    // MISMO objeto de estilo para el <tr> y para la celda
                    // de Fecha congelada — un único color opaco por fila,
                    // así el hover se ve parejo (nada de tono aparte ni
                    // "atraso" en la sticky). La paleta decide si va teñido
                    // por categoría ("full") o neutro ("sober").
                    const rowStyle = categoryRowStyle(row.category, hovered, palette);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border transition-colors last:border-0"
                        style={rowStyle}
                        onMouseEnter={() => setHoveredId(row.id)}
                        onMouseLeave={() => setHoveredId((cur) => (cur === row.id ? null : cur))}
                      >
                        <td
                          className="sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-foreground transition-colors"
                          style={rowStyle}
                        >
                          {formatDateCompact(lang, row.entryDate)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {sober ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                              {catDot && (
                                <span
                                  className="size-1.5 shrink-0 rounded-full"
                                  style={catDot}
                                  aria-hidden
                                />
                              )}
                              {catText}
                            </span>
                          ) : (
                            <span className="font-medium" style={categoryTextStyle(row.category)}>
                              {catText}
                            </span>
                          )}
                          {absorbed && (
                            <span className="block text-[10px] text-muted-foreground">
                              {tt("absorbed_note")}
                            </span>
                          )}
                        </td>
                        <td
                          className={`max-w-44 truncate px-3 py-2 ${
                            sober && row.projectName
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                          title={row.projectName ?? row.clientText ?? undefined}
                        >
                          {row.projectName ? (
                            sober ? (
                              <span className="border-l-2 border-muted-foreground/30 pl-2">
                                {row.projectName}
                              </span>
                            ) : (
                              row.projectName
                            )
                          ) : (
                            <span className="text-muted-foreground/60">{tt("no_project")}</span>
                          )}
                          {row.clientText && (
                            <span className="block truncate text-[10px] font-normal text-muted-foreground/70">
                              {row.clientText}
                            </span>
                          )}
                        </td>
                        <td
                          className="max-w-56 truncate px-3 py-2 text-muted-foreground"
                          title={row.description ?? undefined}
                        >
                          {row.description || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {row.mt2 != null ? row.mt2.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {row.costPerMt2Cents != null ? formatCents(row.costPerMt2Cents) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${absorbed ? "line-through opacity-60" : ""}`}
                          style={row.direction === "a_favor" ? toneTextStyle("a_favor") : undefined}
                        >
                          {row.direction === "a_favor" ? formatCents(row.amountCents) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${absorbed ? "line-through opacity-60" : ""}`}
                          style={row.direction === "reduce" ? toneTextStyle("reduce") : undefined}
                        >
                          {row.direction === "reduce" ? formatCents(row.amountCents) : "—"}
                        </td>
                        <td
                          className="px-3 py-2 text-right font-medium tabular-nums"
                          style={toneTextStyle(balanceTone(row.balanceAfterCents))}
                        >
                          {formatCents(row.balanceAfterCents)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            title={tt("action_edit")}
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            title={tt("mov_delete_title")}
                            disabled={deletingId === row.id}
                            onClick={() => handleDeleteEntry(row.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {groupBy !== "none" && (
                    <tr className="border-b-2 border-border bg-muted/10 text-xs">
                      <td colSpan={6} className="px-3 py-1.5 text-right text-muted-foreground">
                        {tt("group_subtotal")}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={toneTextStyle("a_favor")}>
                        {g.aFavorCents ? formatCents(g.aFavorCents) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={toneTextStyle("reduce")}>
                        {g.reduceCents ? formatCents(g.reduceCents) : "—"}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      <LedgerEntryDialog
        contractorId={contractor.id}
        entry={editing}
        projects={projects}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        onProjectsChanged={reloadProjects}
      />
      <ContractorLiquidationDialog
        contractor={contractor}
        balanceCents={balanceCents}
        open={liqOpen}
        onOpenChange={setLiqOpen}
      />
      <DeleteContractorDialog
        contractor={contractor}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/contratistas")}
      />
    </div>
  );
}
