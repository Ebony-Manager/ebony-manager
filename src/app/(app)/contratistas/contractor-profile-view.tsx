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
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";

import type { Contractor, ContractorLedgerEntry } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
// KPIs con el mismo componente que el Registro de Planilla (Taller) —
// Contratistas es módulo hermano de Planilla y ya reutiliza su capa de
// formato; reusar la tarjeta mantiene el estilo idéntico.
import { PayrollKpiCard } from "@/app/(app)/planilla/payroll-kpi-card";
import { contractorBalanceCents, withRunningBalance } from "@/lib/contractors/contractor-ledger";
import {
  balanceTone,
  categoryChipStyle,
  toneRowBackground,
  toneStickyBackground,
  toneTextStyle,
  toneVar,
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
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { deleteLedgerEntryAction, getContractorLedgerAction } from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { ContractorAvatar } from "./contractor-avatar";
import { LedgerEntryDialog } from "./ledger-entry-dialog";

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

/**
 * Ficha del contratista A PANTALLA COMPLETA (ruta `/contratistas/[id]`):
 * encabezado con datos de contacto + saldo coloreado, fila de KPIs, y el
 * ESTADO DE CUENTA en una tabla ANCHA con scroll horizontal propio y la
 * columna Fecha congelada — mismo patrón que el Registro de Planilla.
 *
 * SALDO: el saldo corrido de cada fila se calcula SIEMPRE sobre la
 * historia completa (`withRunningBalance` sobre todos los movimientos) y
 * NUNCA se reinicia por período. El selector de período solo cambia qué
 * filas se muestran — cada fila visible sigue mostrando su saldo real
 * acumulado, arrastrando todo lo anterior aunque esté oculto (igual que
 * la columna de saldo del Excel del dueño).
 *
 * `initialEntries` llega del server component; tras crear/editar/borrar
 * un movimiento se recarga con `getContractorLedgerAction` y se refresca
 * la ruta (`router.refresh()`) para el directorio.
 */
export function ContractorProfileView({
  contractor,
  initialEntries,
}: {
  contractor: Contractor;
  initialEntries: ContractorLedgerEntry[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [entries, setEntries] = React.useState<ContractorLedgerEntry[]>(initialEntries);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorLedgerEntry | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  // Vista de período — "Mes" por defecto. El ancla arranca en el mes del
  // último movimiento (o el mes actual si no hay ninguno) para que la
  // vista por defecto no salga vacía.
  const [periodView, setPeriodView] = React.useState<LedgerPeriodView>("month");
  const [anchor, setAnchor] = React.useState(() => {
    const last = initialEntries[initialEntries.length - 1];
    const d = last ? last.entryDate : new Date().toISOString().slice(0, 10);
    const [year, month] = d.split("-").map(Number);
    return { year, month };
  });

  const contractorId = contractor.id;

  const load = React.useCallback(() => {
    getContractorLedgerAction(contractorId).then(setEntries);
  }, [contractorId]);

  // Re-sincroniza si el server component vuelve con datos nuevos.
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza el estado local con las props del server. */
  React.useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Saldo corrido sobre la HISTORIA COMPLETA — nunca por período.
  const allRows = React.useMemo(() => withRunningBalance(entries), [entries]);
  const balanceCents = contractorBalanceCents(entries);
  const balTone = balanceTone(balanceCents);

  // KPIs — totales de toda la historia del contratista.
  const kpis = React.useMemo(() => {
    let billed = 0;
    let paid = 0;
    let materials = 0;
    let projects = 0;
    for (const e of entries) {
      if (e.category === "trabajo") {
        projects += 1;
        if (e.direction === "a_favor") billed += e.amountCents;
      } else if (e.category === "pago") {
        paid += e.amountCents;
      } else if (e.category === "material") {
        materials += e.amountCents;
      }
    }
    return { billed, paid, materials, projects };
  }, [entries]);

  // Filas visibles: filtro por período sobre `allRows` (que ya trae el
  // saldo real acumulado en cada fila).
  const visibleRows = React.useMemo(() => {
    if (periodView === "all") return allRows;
    if (periodView === "last15") return allRows.slice(-LAST_N_MOVEMENTS);
    const { startISO, endISO } = calendarWindow(periodView, anchor.year, anchor.month);
    return allRows.filter((r) => r.entryDate >= startISO && r.entryDate <= endISO);
  }, [allRows, periodView, anchor]);

  async function handleDelete(id: string) {
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

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/contratistas">
            <ArrowLeft className="size-3.5" />
            {tt("back_to_directory")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ContractorAvatar name={contractor.name} size="md" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{contractor.name}</h1>
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
          label={tt("f_start_date")}
          value={contractor.startDate ? formatDate(lang, contractor.startDate) : null}
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
          value={String(kpis.projects)}
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
                  onClick={() =>
                    setAnchor((a) => shiftAnchor(periodView, a.year, a.month, -1))
                  }
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
                  onClick={() =>
                    setAnchor((a) => shiftAnchor(periodView, a.year, a.month, 1))
                  }
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            <Select
              value={periodView}
              onValueChange={(v) => setPeriodView(v as LedgerPeriodView)}
            >
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

        {allRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {tt("ledger_empty")}
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {tt("period_empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  {/* Columna "Fecha" congelada al hacer scroll horizontal,
                      igual que "Empleado" en el Registro de Planilla. */}
                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
                    {tt("col_date")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_category")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_client")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_description")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_mt2")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_cost_mt2")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_a_favor")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_reduce")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_balance")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const rowTone = row.ebonyAbsorbsMaterial ? "neutral" : row.direction;
                  const absorbed = row.ebonyAbsorbsMaterial;
                  const hovered = hoveredId === row.id;
                  const chip = categoryChipStyle(row.category);
                  const catText = label(CONTRACTOR_CATEGORY_LABEL_KEY[row.category]);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border transition-colors last:border-0"
                      style={toneRowBackground(rowTone, hovered)}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() => setHoveredId((cur) => (cur === row.id ? null : cur))}
                    >
                      <td
                        className="sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-foreground"
                        style={toneStickyBackground(rowTone, hovered)}
                      >
                        {formatDate(lang, row.entryDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {chip ? (
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                            style={chip}
                          >
                            {catText}
                          </span>
                        ) : (
                          <span className="text-foreground">{catText}</span>
                        )}
                        {absorbed && (
                          <span className="block text-[10px] text-muted-foreground">
                            {tt("absorbed_note")}
                          </span>
                        )}
                      </td>
                      {/* NOTA (futuro): cuando exista el módulo de Proyectos,
                          este "Cliente" texto libre pasa a ser un dropdown que
                          engancha a un proyecto existente (evita repetir el
                          mismo cliente con variaciones). Por ahora: texto libre. */}
                      <td
                        className="max-w-40 truncate px-3 py-2 text-muted-foreground"
                        title={row.clientText ?? undefined}
                      >
                        {row.clientText || "—"}
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
                          onClick={() => handleDelete(row.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LedgerEntryDialog
        contractorId={contractor.id}
        entry={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </div>
  );
}
