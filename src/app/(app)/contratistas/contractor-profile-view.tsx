"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hammer,
  HandCoins,
  LogOut,
  Package,
  Palette,
  Pencil,
  Plus,
  Receipt,
  Settings,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

import type {
  Contractor,
  ContractorAllocation,
  ContractorContract,
  ContractorLedgerEntry,
  LaborRate,
  Project,
} from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { isScheduled, todayInPanama } from "@/lib/contractors/contractor-loans";
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
  getContractorAllocationsAction,
  getContractorLedgerAction,
  getContractsAction,
  getProjectsAction,
  updateContractorAction,
} from "./actions";
import { contractPendingCents, looseCredits, sortContracts, unallocatedSources } from "@/lib/contractors/contracts";
import { ContractDialog } from "./contract-dialog";
import { ContractsTable } from "./contracts-table";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { AddChargeDialog } from "@/app/(app)/planilla/add-charge-dialog";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { ContractorAvatar } from "./contractor-avatar";
import { ContractorFormDialog } from "./contractor-form-dialog";
import { ProfilePhotoPicker } from "@/components/shared/profile-photo-picker";
import { IdDocumentFile } from "@/components/shared/id-document-file";
import { jotformDocumentUrlFromNotes } from "@/lib/personal/jotform-intake";
import { importJotformDocumentAction } from "@/app/(app)/personal/staff/actions";
import { countryName } from "@/lib/countries";
import { contractorBackPath, type ContractorFrom } from "@/lib/personal/paths";
import { LedgerEntryDialog } from "./ledger-entry-dialog";
import { ContractorLiquidationDialog } from "./contractor-liquidation-dialog";
import { ContractorHelpersDialog } from "./contractor-helpers-dialog";
import { DeleteContractorDialog } from "./delete-contractor-dialog";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ConfirmButton } from "@/components/shared/confirm-button";

/** Fila compacta de dato personal para el menú del engranaje. */
/** Un dato de la ficha "Datos del contratista" (mismo formato que la del empleado). */
function DataItem({ label, value, hideWhenEmpty = false }: { label: string; value: React.ReactNode; hideWhenEmpty?: boolean }) {
  const { lang } = useLang();
  if (!value && hideWhenEmpty) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "text-foreground" : "text-muted-foreground/70"}>{value || t(lang, strings.planilla.pd_not_set)}</dd>
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

// La vista de período del estado de cuenta se recuerda por navegador.
const PERIOD_STORAGE_KEY = "contratistas:ledger-period";

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

// Si la fila de KPIs va expandida o colapsada — también se recuerda.
const KPIS_STORAGE_KEY = "contratistas:kpis-open";
function readStoredKpisOpen(): boolean | null {
  try {
    const v = window.localStorage.getItem(KPIS_STORAGE_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

/**
 * Ficha del contratista A PANTALLA COMPLETA (`/personal/staff/contratistas/[id]`):
 * tarjeta de encabezado (nombre/tipo + saldo), KPIs colapsables y el
 * estado de cuenta. Los datos personales y las acciones de estado
 * (inactivar / liquidar / reactivar / borrar) viven en el menú del
 * engranaje del encabezado — nada de eso ocupa espacio en la ficha.
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
  photoUrl: initialPhotoUrl,
  documentUrl,
  initialEntries,
  initialProjects,
  initialContracts,
  initialAllocations,
  laborRates,
  from,
}: {
  contractor: Contractor;
  photoUrl: string | null;
  /** URL firmada del documento (cédula / pasaporte), si tiene. */
  documentUrl: string | null;
  initialEntries: ContractorLedgerEntry[];
  initialProjects: Project[];
  /** Contratos de este contratista. */
  initialContracts: ContractorContract[];
  /** Sus abonos (qué movimiento se abonó a qué contrato). */
  initialAllocations: ContractorAllocation[];
  laborRates: LaborRate[];
  /** Pantalla desde la que se llegó (a ella regresa "Volver"); sin esto, a Staff. */
  from?: ContractorFrom;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [entries, setEntries] = React.useState<ContractorLedgerEntry[]>(initialEntries);
  const [projects, setProjects] = React.useState<Project[]>(initialProjects);
  const [contracts, setContracts] = React.useState<ContractorContract[]>(initialContracts);
  const [allocations, setAllocations] = React.useState<ContractorAllocation[]>(initialAllocations);
  const [contractEditing, setContractEditing] = React.useState<ContractorContract | null>(null);
  const [contractAdding, setContractAdding] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [chargeOpen, setChargeOpen] = React.useState(false);
  const [showCompletedContracts, setShowCompletedContracts] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorLedgerEntry | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const [liqOpen, setLiqOpen] = React.useState(false);
  const [helpersOpen, setHelpersOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reactivating, setReactivating] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(initialPhotoUrl);
  const [photoPath, setPhotoPath] = React.useState<string | null>(contractor.photoPath);

  // Vista de período — "Últimos 15 movimientos" por defecto (con "Mes", un
  // abono a inicio de mes se veía solo, sin el trabajo que paga). La
  // elección se recuerda por navegador. El ancla de las vistas por
  // calendario arranca en el mes del último movimiento.
  const [periodView, setPeriodView] = React.useState<LedgerPeriodView>("last15");
  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(PERIOD_STORAGE_KEY);
      if (v && (LEDGER_PERIOD_VIEWS as readonly string[]).includes(v)) setPeriodView(v as LedgerPeriodView);
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(PERIOD_STORAGE_KEY, periodView);
    } catch {
      /* ignore */
    }
  }, [periodView]);
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

  // Paleta de la tabla: "full" (fila a todo color) o "sober" (neutra, por
  // defecto — la marca no tiene acento de color, así que la vista sobria
  // es la que se ve al abrir). Arranca en "sober" para que el server y el
  // primer render del cliente coincidan; la preferencia guardada se
  // aplica tras hidratar.
  const [palette, setPalette] = React.useState<LedgerPalette>("sober");
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

  // Fila de KPIs colapsable — por defecto expandida; la elección se
  // recuerda para dar más espacio a la tabla cuando el usuario quiera.
  const [kpisOpen, setKpisOpen] = React.useState(true);
  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    const stored = readStoredKpisOpen();
    if (stored !== null) setKpisOpen(stored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(KPIS_STORAGE_KEY, kpisOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [kpisOpen]);

  const contractorId = contractor.id;

  // Un movimiento puede cambiar el valor o lo abonado de un contrato: se
  // recargan los tres juntos.
  const load = React.useCallback(() => {
    getContractorLedgerAction(contractorId).then(setEntries);
    getContractsAction({ contractorId }).then(setContracts);
    getContractorAllocationsAction(contractorId).then(setAllocations);
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
  React.useEffect(() => {
    setContracts(initialContracts);
  }, [initialContracts]);
  React.useEffect(() => {
    setAllocations(initialAllocations);
  }, [initialAllocations]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Saldo corrido sobre la HISTORIA COMPLETA — nunca por período/filtro.
  const allRows = React.useMemo(() => withRunningBalance(entries), [entries]);
  // Las cuotas programadas (préstamos en cuotas, fecha futura) se ven en el
  // estado de cuenta pero todavía no cuentan en el saldo de hoy.
  const today = React.useMemo(() => todayInPanama(), []);
  const balanceCents = contractorBalanceCents(entries.filter((e) => !isScheduled(e, today)));
  const balTone = balanceTone(balanceCents);

  // KPIs — totales de toda la historia del contratista.
  const kpis = React.useMemo(() => {
    let billed = 0;
    let paid = 0;
    let materials = 0;
    for (const e of entries) {
      if (e.category === "trabajo") {
        if (e.direction === "a_favor") billed += e.amountCents;
      } else if (e.category === "pago") {
        paid += e.amountCents;
      } else if (e.category === "material") {
        materials += e.amountCents;
      }
    }
    return { billed, paid, materials };
  }, [entries]);

  // Contratos: activos arriba, terminados plegados. Lo que falta, lo que
  // está a cuenta (se descuenta en el próximo pago) y lo acreditado sin
  // contrato (historia vieja, bonos).
  const sortedContracts = React.useMemo(() => sortContracts(contracts), [contracts]);
  const activeContracts = sortedContracts.filter((c) => c.status === "ACTIVE");
  const completedContracts = sortedContracts.filter((c) => c.status !== "ACTIVE");
  const contractsPendingCents = contracts.reduce((s, c) => s + Math.max(0, contractPendingCents(c)), 0);
  const contractsRetainedCents = contracts.reduce(
    (s, c) => s + Math.min(c.retentionCents, Math.max(0, contractPendingCents(c))),
    0
  );
  const onAccountCents = React.useMemo(
    () => unallocatedSources(entries, allocations, today).reduce((s, r) => s + r.remainingCents, 0),
    [entries, allocations, today]
  );
  const looseCents = React.useMemo(
    () => looseCredits(entries, allocations).reduce((s, r) => s + r.remainingCents, 0),
    [entries, allocations]
  );

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
    setDeletingId(id);
    try {
      await deleteLedgerEntryAction(id);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReactivate() {
    setReactivating(true);
    try {
      await updateContractorAction(contractor.id, { status: "ACTIVE", endDate: null });
      toast.success(tt("reactivate_done"));
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

  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const bankTypeLabel =
    contractor.bankAccountType === "ahorro" ? tp("bank_type_ahorro") : contractor.bankAccountType === "corriente" ? tp("bank_type_corriente") : "";
  const bank = [contractor.bankName, bankTypeLabel, contractor.bankAccountNumber].filter(Boolean).join(" · ");
  const docType =
    contractor.idDocumentType === "pasaporte" ? tp("id_type_pasaporte") : contractor.idDocumentType === "cedula" ? tp("id_type_cedula") : "";
  const emergency = [contractor.emergencyContactName, contractor.emergencyContactPhone].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href={contractorBackPath(from)}>
              <ArrowLeft className="size-3.5" />
              {t(lang, strings.common.back)}
            </Link>
          </Button>

          {/* Ajustes del contratista: datos personales (discretos) +
              inactivar / liquidar / reactivar / eliminar. Nada de esto va
              suelto en la ficha. */}
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
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {tt("status_label")}:{" "}
                <span className="font-medium text-foreground">
                  {isInactive ? tt("status_inactive") : tt("status_active")}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.setTimeout(() => setHelpersOpen(true), 0)}>
                <Users className="size-3.5" />
                {tt("helpers_menu")}
              </DropdownMenuItem>
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

        {/* Tarjeta de encabezado única: nombre + tipo a la izquierda,
            saldo a la derecha. Reemplaza la vieja tarjeta grande de
            "Fecha de inicio". */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ProfilePhotoPicker
                bucket="contractor-photos"
                ownerId={contractor.id}
                currentPath={photoPath}
                hasPhoto={photoUrl !== null}
                savePath={(path) => updateContractorAction(contractor.id, { photoPath: path })}
                onPhotoChange={(url, path) => {
                  setPhotoUrl(url);
                  setPhotoPath(path);
                }}
              >
                <ContractorAvatar name={contractor.name} photoUrl={photoUrl} size="xl" />
              </ProfilePhotoPicker>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
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
        </Card>
      </div>

      {/* Datos del contratista — la "ficha" con todo lo que se sabe de la persona, como la del empleado. */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{tt("details_section_title")}</h2>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
            {tp("pd_edit")}
          </Button>
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DataItem
            label={tp("pd_document")}
            value={
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {contractor.idDocument ? (
                  [docType, contractor.idDocument].filter(Boolean).join(" ")
                ) : (
                  <span className="text-muted-foreground/70">{tp("pd_not_set")}</span>
                )}
                <IdDocumentFile
                  kind="contractor"
                  ownerId={contractor.id}
                  initialPath={contractor.idDocumentPath}
                  initialUrl={documentUrl}
                  savePath={(path) => updateContractorAction(contractor.id, { idDocumentPath: path })}
                  importFromJotform={
                    jotformDocumentUrlFromNotes(contractor.notes) ? () => importJotformDocumentAction("contractor", contractor.id) : undefined
                  }
                />
              </span>
            }
          />
          <DataItem label={tp("f_nationality")} value={countryName(contractor.nationality, lang)} />
          <DataItem label={tp("f_birth_date")} value={contractor.birthDate ? formatDate(lang, contractor.birthDate) : null} />
          <DataItem
            label={tp("f_phone")}
            value={
              contractor.phone ? (
                <a href={`tel:${contractor.phone}`} className="hover:text-primary">
                  {contractor.phone}
                </a>
              ) : null
            }
          />
          <DataItem
            label={tp("f_email")}
            value={
              contractor.email ? (
                <a href={`mailto:${contractor.email}`} className="break-all hover:text-primary">
                  {contractor.email}
                </a>
              ) : null
            }
          />
          <DataItem label={tp("f_address")} value={contractor.address} />
          <DataItem label={tp("pd_contact")} value={emergency || null} />
          <DataItem label={tp("f_contract")} value={contractor.contractInfo} />
          <DataItem label={tt("f_start_date")} value={contractor.startDate ? formatDate(lang, contractor.startDate) : null} />
          <DataItem label={tt("end_date_label")} value={contractor.endDate ? formatDate(lang, contractor.endDate) : null} hideWhenEmpty />
          <DataItem label={tp("pd_bank")} value={bank || null} />
          <DataItem label={tp("f_bank_routing_code")} value={contractor.bankRoutingCode} hideWhenEmpty />
        </dl>
      </section>

      {contractor.notes && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {contractor.notes}
        </div>
      )}

      {/* KPIs del contratista — colapsables para ganar espacio para la
          tabla. Estilo de tarjeta consistente con Planilla (Taller). */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setKpisOpen((o) => !o)}
          aria-expanded={kpisOpen}
          title={tt("kpis_toggle_hint")}
          className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {kpisOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          {tt("kpis_title")}
        </button>
        {kpisOpen && (
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
              label={tt("kpi_contracts")}
              value={String(contracts.length)}
              sublabel={`${activeContracts.length} ${tt("kpi_contracts_active")}`}
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
        )}
      </div>

      {/* Contratos: lo acordado y lo abonado. */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">{tt("ct_section_title")}</h2>
            <p className="text-xs text-muted-foreground">
              {tt("ct_col_pending")}: <span className="font-medium text-foreground tabular-nums">{formatCents(contractsPendingCents)}</span>
              {contractsRetainedCents > 0 && (
                <>
                  {" "}
                  <span title={tt("ct_retained_hint")}>
                    ({tt("ct_retained").toLowerCase()} {formatCents(contractsRetainedCents)})
                  </span>
                </>
              )}
              {looseCents > 0 && (
                <>
                  {" · "}
                  {tt("pay_loose")}: <span className="tabular-nums">{formatCents(looseCents)}</span>
                </>
              )}
              {onAccountCents > 0 && (
                <>
                  {" · "}
                  {tt("ct_on_account")}: <span className="tabular-nums">{formatCents(onAccountCents)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setContractAdding(true)}>
              <Plus className="size-3.5" />
              {tt("ct_add")}
            </Button>
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Banknote className="size-3.5" />
              {tt("pay_title")}
            </Button>
          </div>
        </div>

        {contracts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {tt("ct_empty_contractor")}
          </p>
        ) : (
          <>
            {activeContracts.length > 0 ? (
              <ContractsTable contracts={activeContracts} onOpen={setContractEditing} />
            ) : (
              <p className="text-xs text-muted-foreground">{tt("ct_no_active")}</p>
            )}
            {completedContracts.length > 0 && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompletedContracts((v) => !v)}
                  className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {showCompletedContracts ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  {tt("proj_completed_section")} ({completedContracts.length})
                </button>
                {showCompletedContracts && <ContractsTable contracts={completedContracts} onOpen={setContractEditing} />}
              </div>
            )}
          </>
        )}
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
              <div className="flex items-center gap-1 rounded-lg border border-border px-1">
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

            <Button size="sm" variant="outline" onClick={() => setChargeOpen(true)}>
              <HandCoins className="size-3.5" />
              {tt("ledger_add_charge")}
            </Button>
            {/* Lo ocasional (material, gasto, extra, ajuste): más discreto. */}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
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

        {/* Filtros (categoría, proyecto) + interruptor de paleta. */}
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

        {/* Agrupar por — tabs pequeñas encima de la tabla. "Sin agrupar"
            es la 4ª tab (vuelve al estado sin agrupación). */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{tt("group_by")}:</span>
          <SegmentedFilter
            value={groupBy}
            onChange={setGroupBy}
            options={LEDGER_GROUP_BYS.map((g) => ({ value: g, label: g === "none" ? tt("group_none") : tt(GROUP_BY_LABEL_KEY[g]) }))}
          />
        </div>

        {/* Total de lo filtrado — suma de lo VISIBLE (no el saldo corrido). */}
        {filteredRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
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
                    // Lo que forma el valor de un contrato se lee "Contrato"; el
                    // trabajo viejo suelto (sin contrato) sigue como "Trabajo".
                    const catText = label(
                      row.category === "trabajo" && row.contractId ? "cat_contrato" : CONTRACTOR_CATEGORY_LABEL_KEY[row.category]
                    );
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
                          title={row.contractName ?? row.projectName ?? row.clientText ?? undefined}
                        >
                          {row.contractName || row.projectName ? (
                            sober ? (
                              <span className="border-l-2 border-muted-foreground/30 pl-2">
                                {row.contractName ?? row.projectName}
                              </span>
                            ) : (
                              (row.contractName ?? row.projectName)
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
                          title={row.itemsSummary ?? row.description ?? undefined}
                        >
                          {isScheduled(row, today) && (
                            <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {tt("scheduled")}
                            </span>
                          )}
                          {row.itemsSummary ?? row.description ?? "—"}
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
                          <ConfirmButton
                            iconOnly
                            className="p-1"
                            label={tt("mov_delete_title")}
                            confirmLabel={t(lang, strings.nav.confirm_delete)}
                            disabled={deletingId === row.id}
                            onConfirm={() => void handleDeleteEntry(row.id)}
                          />
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
        contractorName={contractor.name}
        contractorType={contractor.contractorType}
        laborRates={laborRates}
        entry={editing}
        projects={projects}
        contracts={contracts}
        allocations={allocations}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        onContractsChanged={load}
        onProjectsChanged={reloadProjects}
      />
      <ContractDialog
        open={contractAdding || contractEditing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setContractAdding(false);
            setContractEditing(null);
          }
        }}
        contract={contractEditing}
        contractors={[]}
        fixedContractor={{ id: contractor.id, name: contractor.name, contractorType: contractor.contractorType }}
        projects={projects}
        laborRates={laborRates}
        onSaved={load}
        onProjectsChanged={reloadProjects}
      />
      <RegisterPaymentDialog
        contractor={{ id: contractor.id, name: contractor.name }}
        contracts={contracts}
        entries={entries}
        allocations={allocations}
        open={payOpen}
        onOpenChange={setPayOpen}
        onSaved={load}
      />
      <AddChargeDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        person={{ kind: "contractor", id: contractor.id, name: contractor.name }}
        onSaved={load}
      />
      <ContractorFormDialog contractor={contractor} open={editOpen} onOpenChange={setEditOpen} />
      <ContractorHelpersDialog contractor={contractor} open={helpersOpen} onOpenChange={setHelpersOpen} />
      <ContractorLiquidationDialog
        contractor={contractor}
        balanceCents={balanceCents}
        open={liqOpen}
        onOpenChange={setLiqOpen}
        onSaved={load}
      />
      <DeleteContractorDialog
        contractor={contractor}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push(contractorBackPath(from))}
      />
    </div>
  );
}
