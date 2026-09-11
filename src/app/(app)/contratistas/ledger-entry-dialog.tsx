"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import type {
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
  ContractorType,
  LaborRate,
  LaborRatePhase,
  LaborRateUnit,
  Project,
} from "@/types/contractors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/planilla/payroll-period";
import {
  CONTRACTOR_LEDGER_CATEGORIES,
  directionForCategory,
  isMaterialCategory,
  lineAmountCents,
} from "@/lib/contractors/contractor-ledger";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLedgerEntryAction, getLedgerEntryItemsAction, updateLedgerEntryAction } from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { Field } from "./field";
import { ProjectFormDialog } from "./project-form-dialog";

type AmountMode = "flat" | "area";

const NO_PROJECT = "__none__";
const NEW_PROJECT = "__new__";
const NO_ITEM_PICKED = "";

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function toNum(value: string): number | null {
  const n = parseFloat(value || "");
  return Number.isFinite(n) ? n : null;
}

/** Línea de trabajo en construcción dentro del formulario — `cantidad`
 *  queda como texto (igual que los demás inputs numéricos del diálogo)
 *  hasta el submit, donde se convierte y se congela junto al resto. */
interface DraftItem {
  key: string;
  laborRateId: string | null;
  descripcion: string;
  /** Nota opcional de la pieza específica de mueble (ej. "Mueble de TV"). */
  detalle: string;
  fase: LaborRatePhase | null;
  unidad: LaborRateUnit;
  precioUnitarioCents: number;
  cantidad: string;
}

function itemSubtotalCents(it: DraftItem): number {
  const qty = parseFloat(it.cantidad || "0");
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.round(qty * it.precioUnitarioCents);
}

/**
 * Crear o editar un movimiento del estado de cuenta de un contratista.
 *
 * REGLA DE DIRECCIÓN: la categoría fija sola si el movimiento sube o baja
 * el saldo (`directionForCategory`); ese control NO se le muestra al
 * usuario. Solo en "Ajuste" se le pregunta si suma o resta.
 *
 * PROYECTO (C2): el movimiento se engancha a un proyecto existente
 * (`projectId`) o a ninguno; se puede crear un proyecto nuevo ahí mismo.
 * `clientText` queda como nota libre opcional (cliente final).
 */
export function LedgerEntryDialog({
  contractorId,
  contractorType,
  laborRates,
  entry,
  projects,
  open,
  onOpenChange,
  onSaved,
  onProjectsChanged,
}: {
  contractorId: string;
  /** Filtra el catálogo de ítems al tipo de ESTE contratista. */
  contractorType: ContractorType;
  /** Catálogo completo de tarifas; se filtra por tipo + activas acá. */
  laborRates: LaborRate[];
  /** null = crear; una entrada = editar. */
  entry: ContractorLedgerEntry | null;
  projects: Project[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Recargar la lista de proyectos del padre tras crear uno en línea. */
  onProjectsChanged: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [category, setCategory] = React.useState<ContractorLedgerCategory>("trabajo");
  const [adjustDirection, setAdjustDirection] = React.useState<ContractorLedgerDirection>("a_favor");
  const [amountMode, setAmountMode] = React.useState<AmountMode>("flat");
  const [flatAmount, setFlatAmount] = React.useState("");
  const [mt2, setMt2] = React.useState("");
  const [costPerMt2, setCostPerMt2] = React.useState("");
  const [entryDate, setEntryDate] = React.useState(today);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [clientText, setClientText] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [ebonyAbsorbs, setEbonyAbsorbs] = React.useState(false);
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [itemPicker, setItemPicker] = React.useState(NO_ITEM_PICKED);
  // key del ítem cuyo "Detalle" está en edición — solo lectura + lápiz
  // para los demás, así la tabla no queda con un input siempre abierto
  // por línea.
  const [editingDetailKey, setEditingDetailKey] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Proyectos creados en línea desde este diálogo — se muestran al toque
  // sin esperar a que el padre recargue.
  const [extraProjects, setExtraProjects] = React.useState<Project[]>([]);
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir; la entrada editada cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setExtraProjects([]);
    setItemPicker(NO_ITEM_PICKED);
    setEditingDetailKey(null);
    if (entry) {
      const area = entry.mt2 != null && entry.costPerMt2Cents != null;
      setCategory(entry.category);
      setAdjustDirection(entry.direction);
      setAmountMode(area ? "area" : "flat");
      setFlatAmount(area ? "" : (entry.amountCents / 100).toFixed(2));
      setMt2(entry.mt2 != null ? String(entry.mt2) : "");
      setCostPerMt2(entry.costPerMt2Cents != null ? (entry.costPerMt2Cents / 100).toFixed(2) : "");
      setEntryDate(entry.entryDate);
      setProjectId(entry.projectId);
      setClientText(entry.clientText ?? "");
      setDescription(entry.description ?? "");
      setNotes(entry.notes ?? "");
      setEbonyAbsorbs(entry.ebonyAbsorbsMaterial);
      // Los ítems (si los hay) se cargan aparte, de forma asíncrona, en
      // el efecto de abajo — acá arranca vacío para no mostrar datos
      // viejos de la entrada anterior mientras llegan.
      setItems([]);
    } else {
      setCategory("trabajo");
      setAdjustDirection("a_favor");
      setAmountMode("flat");
      setFlatAmount("");
      setMt2("");
      setCostPerMt2("");
      setEntryDate(today);
      setProjectId(null);
      setClientText("");
      setDescription("");
      setNotes("");
      setEbonyAbsorbs(false);
      setItems([]);
    }
  }, [open, entry, today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Carga los ítems ya guardados al reabrir un movimiento de categoría
  // 'trabajo' para editar — con los valores CONGELADOS tal como se
  // guardaron, no los precios actuales de labor_rates.
  React.useEffect(() => {
    if (!open || !entry || entry.category !== "trabajo") return;
    let cancelled = false;
    getLedgerEntryItemsAction(entry.id).then((loaded) => {
      if (cancelled) return;
      setItems(
        loaded.map((it) => ({
          key: it.id,
          laborRateId: it.laborRateId,
          descripcion: it.descripcion,
          detalle: it.detalle ?? "",
          fase: it.fase,
          unidad: it.unidad,
          precioUnitarioCents: it.precioUnitarioCents,
          cantidad: String(it.cantidad),
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

  const fixedDirection = directionForCategory(category);
  const showMaterialToggle = isMaterialCategory(category);

  // Lista para el selector: proyectos del padre + los creados en línea,
  // sin duplicar, ordenados con los activos primero y por nombre.
  const projectOptions = React.useMemo(() => {
    const byId = new Map<string, Project>();
    for (const p of [...projects, ...extraProjects]) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => {
      if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [projects, extraProjects]);

  function onCategoryChange(next: ContractorLedgerCategory) {
    setCategory(next);
    if (!isMaterialCategory(next)) setEbonyAbsorbs(false);
  }

  function onProjectSelect(value: string) {
    if (value === NEW_PROJECT) {
      setProjectDialogOpen(true);
      return;
    }
    setProjectId(value === NO_PROJECT ? null : value);
  }

  function onProjectCreated(created: Project) {
    setExtraProjects((cur) => [...cur, created]);
    setProjectId(created.id);
    onProjectsChanged();
  }

  // Ítems de trabajo — solo para categoría 'trabajo'. Catálogo filtrado
  // al tipo de ESTE contratista y a tarifas activas únicamente.
  const isWorkCategory = category === "trabajo";
  const activeRates = React.useMemo(
    () => laborRates.filter((r) => r.contractorType === contractorType && r.activo),
    [laborRates, contractorType]
  );
  const hasItems = isWorkCategory && items.length > 0;
  const itemsTotalCents = items.reduce((sum, it) => sum + itemSubtotalCents(it), 0);

  function onPickItem(rateId: string) {
    const rate = activeRates.find((r) => r.id === rateId);
    if (!rate) return;
    setItems((cur) => [
      ...cur,
      {
        key: crypto.randomUUID(),
        laborRateId: rate.id,
        descripcion: rate.descripcion,
        detalle: "",
        fase: rate.fase,
        unidad: rate.unidad,
        precioUnitarioCents: rate.precioCents,
        cantidad: "",
      },
    ]);
    setItemPicker(NO_ITEM_PICKED);
  }

  function onItemQtyChange(key: string, value: string) {
    setItems((cur) => cur.map((it) => (it.key === key ? { ...it, cantidad: value } : it)));
  }

  function onItemDetailChange(key: string, value: string) {
    setItems((cur) => cur.map((it) => (it.key === key ? { ...it, detalle: value } : it)));
  }

  function onRemoveItem(key: string) {
    setItems((cur) => cur.filter((it) => it.key !== key));
  }

  function unitLabel(u: LaborRateUnit) {
    return u === "m2" ? tt("unit_m2") : u === "ml" ? tt("unit_ml") : tt("unit_unidad");
  }

  function phaseLabel(f: LaborRatePhase | null) {
    if (!f) return null;
    return f === "armado" ? tt("phase_armado") : tt("phase_instalacion");
  }

  const computedCents = hasItems
    ? itemsTotalCents
    : amountMode === "area"
      ? lineAmountCents({ mt2: toNum(mt2), costPerMt2Cents: toCents(costPerMt2), flatAmountCents: 0 })
      : toCents(flatAmount);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasItems && items.some((it) => itemSubtotalCents(it) <= 0)) {
      setError(tt("mov_item_qty_required"));
      return;
    }
    if (computedCents <= 0) {
      setError(tt("mov_amount_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        projectId,
        entryDate,
        category,
        direction: fixedDirection ?? adjustDirection,
        mt2: !hasItems && amountMode === "area" ? toNum(mt2) : null,
        costPerMt2Cents: !hasItems && amountMode === "area" ? toCents(costPerMt2) : null,
        amountCents: computedCents,
        ebonyAbsorbsMaterial: showMaterialToggle ? ebonyAbsorbs : false,
        clientText: clientText.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        items: isWorkCategory
          ? items.map((it) => ({
              laborRateId: it.laborRateId,
              descripcion: it.descripcion,
              detalle: it.detalle.trim() || null,
              fase: it.fase,
              unidad: it.unidad,
              precioUnitarioCents: it.precioUnitarioCents,
              cantidad: parseFloat(it.cantidad),
              subtotalCents: itemSubtotalCents(it),
            }))
          : [],
      };
      if (entry) {
        await updateLedgerEntryAction(entry.id, input);
      } else {
        await createLedgerEntryAction({ contractorId, ...input });
      }
      toast.success(tt("mov_saved"));
      onOpenChange(false);
      onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-[min(95vw,42rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entry ? tt("mov_edit_title") : tt("mov_add_title")}</DialogTitle>
            <DialogDescription>{tt("mov_desc")}</DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tt("mov_f_category")}>
                <Select value={category} onValueChange={(v) => onCategoryChange(v as ContractorLedgerCategory)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACTOR_LEDGER_CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(lang, strings.contratistas[CONTRACTOR_CATEGORY_LABEL_KEY[key] as keyof typeof strings.contratistas])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("mov_f_date")}>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </Field>

              {/* Dirección: solo se pregunta en "Ajuste". */}
              {fixedDirection === null && (
                <Field label={tt("mov_f_adjust_dir")} className="sm:col-span-2">
                  <Select
                    value={adjustDirection}
                    onValueChange={(v) => setAdjustDirection(v as ContractorLedgerDirection)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_favor">{tt("adjust_a_favor")}</SelectItem>
                      <SelectItem value="reduce">{tt("adjust_reduce")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* Proyecto: el enganche real del movimiento. */}
              <Field label={tt("mov_f_project")} className="sm:col-span-2">
                <Select value={projectId ?? NO_PROJECT} onValueChange={onProjectSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>{tt("mov_f_project_none")}</SelectItem>
                    {projectOptions.length > 0 && <SelectSeparator />}
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.status === "COMPLETED" ? ` · ${tt("proj_status_completed")}` : ""}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={NEW_PROJECT}>{tt("mov_f_project_new")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Ítems de trabajo — solo categoría 'trabajo'. Al agregar al
                menos uno, reemplazan el monto a mano (ver bloque de abajo). */}
            {isWorkCategory && (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <span className="text-xs font-medium text-muted-foreground">{tt("mov_items_title")}</span>

                <Select value={itemPicker} onValueChange={onPickItem}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tt("mov_items_add_ph")} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRates.length === 0 ? (
                      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                        {tt("mov_items_empty_catalog")}
                      </div>
                    ) : (
                      activeRates.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.descripcion}
                          {r.fase ? ` — ${phaseLabel(r.fase)}` : ""} · {formatCents(r.precioCents)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {items.length > 0 && (
                  <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-md border border-border">
                    <table className="w-full min-w-[560px] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                          <th className="px-2 py-1.5 text-left font-medium">{tt("rates_col_description")}</th>
                          <th className="px-2 py-1.5 text-left font-medium">{tt("mov_items_col_detail")}</th>
                          <th className="px-2 py-1.5 text-left font-medium">{tt("rates_col_unit")}</th>
                          <th className="px-2 py-1.5 text-right font-medium">{tt("mov_items_col_qty")}</th>
                          <th className="px-2 py-1.5 text-right font-medium">{tt("rates_col_price")}</th>
                          <th className="px-2 py-1.5 text-right font-medium">{tt("mov_items_col_subtotal")}</th>
                          <th className="px-1 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={it.key} className="border-b border-border last:border-0">
                            <td className="px-2 py-1.5 text-foreground">
                              {it.descripcion}
                              {it.fase && (
                                <span className="text-muted-foreground"> — {phaseLabel(it.fase)}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {editingDetailKey === it.key ? (
                                <Input
                                  value={it.detalle}
                                  onChange={(e) => onItemDetailChange(it.key, e.target.value)}
                                  onBlur={() => setEditingDetailKey(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      setEditingDetailKey(null);
                                    }
                                  }}
                                  placeholder={tt("mov_items_detail_ph")}
                                  className="h-7 w-32"
                                  autoFocus
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="truncate text-muted-foreground">
                                    {it.detalle.trim() || "—"}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                                    title={tt("action_edit")}
                                    onClick={() => setEditingDetailKey(it.key)}
                                  >
                                    <Pencil className="size-3" />
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">{unitLabel(it.unidad)}</td>
                            <td className="px-2 py-1.5 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                value={it.cantidad}
                                onChange={(e) => onItemQtyChange(it.key, e.target.value)}
                                placeholder="0.00"
                                className="h-7 w-20 text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              {formatCents(it.precioUnitarioCents)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium tabular-nums text-foreground">
                              {formatCents(itemSubtotalCents(it))}
                            </td>
                            <td className="px-1 py-1.5 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                title={tt("mov_items_remove")}
                                onClick={() => onRemoveItem(it.key)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
                            {tt("mov_items_total")}
                          </td>
                          <td className="px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-foreground">
                            {formatCents(itemsTotalCents)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Monto: calculado desde los ítems (solo lectura) o fijo /
                m² × costo/m² a mano — igual que antes cuando no hay ítems. */}
            {hasItems ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{tt("mov_f_amount_mode")}</p>
                  <p className="text-xs text-muted-foreground">{tt("mov_amount_from_items")}</p>
                </div>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {formatCents(itemsTotalCents)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{tt("mov_f_amount_mode")}:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={amountMode === "flat" ? "default" : "outline"}
                    onClick={() => setAmountMode("flat")}
                  >
                    {tt("amount_mode_flat")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={amountMode === "area" ? "default" : "outline"}
                    onClick={() => setAmountMode("area")}
                  >
                    {tt("amount_mode_area")}
                  </Button>
                </div>

                {amountMode === "flat" ? (
                  <Field label={tt("mov_f_flat")}>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={flatAmount}
                      onChange={(e) => setFlatAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={tt("mov_f_mt2")}>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={mt2}
                          onChange={(e) => setMt2(e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label={tt("mov_f_cost_mt2")}>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={costPerMt2}
                          onChange={(e) => setCostPerMt2(e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tt("mov_computed")}:{" "}
                      <span className="font-medium text-foreground tabular-nums">{formatCents(computedCents)}</span>
                    </p>
                  </>
                )}
              </div>
            )}

            {showMaterialToggle && (
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={ebonyAbsorbs}
                  onChange={(e) => setEbonyAbsorbs(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input accent-primary"
                />
                <span>
                  <span className="font-medium text-foreground">{tt("mov_f_ebony_absorbs")}</span>
                  <span className="block text-xs text-muted-foreground">{tt("mov_f_ebony_absorbs_hint")}</span>
                </span>
              </label>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Field label={tt("mov_f_client_note")}>
                <Input value={clientText} onChange={(e) => setClientText(e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("mov_f_description")}>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tt("f_optional")}
                />
              </Field>
              <Field label={tt("mov_f_notes")} className="sm:col-span-2">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {tt("action_cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? tt("saving") : entry ? tt("action_save") : tt("action_add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProjectFormDialog
        project={null}
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onCreated={onProjectCreated}
      />
    </>
  );
}
