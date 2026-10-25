"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { ContractorLedgerEntryItem, LaborRate, LaborRatePhase, LaborRateUnit } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/planilla/payroll-period";
import { lineAmountCents } from "@/lib/contractors/contractor-ledger";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { Field } from "./field";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";

/** Línea de trabajo en construcción — `cantidad` queda como texto (igual
 *  que los demás inputs numéricos) hasta guardar, donde se convierte y se
 *  congela junto al resto. */
export interface DraftItem {
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

/** Piezas (o monto fijo / m² × costo) de un trabajo o de un contrato. */
export interface WorkDraft {
  items: DraftItem[];
  amountMode: "flat" | "area";
  flatAmount: string;
  mt2: string;
  costPerMt2: string;
}

export const EMPTY_WORK: WorkDraft = { items: [], amountMode: "flat", flatAmount: "", mt2: "", costPerMt2: "" };

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function toNum(value: string): number | null {
  const n = parseFloat(value || "");
  return Number.isFinite(n) ? n : null;
}

export function itemSubtotalCents(it: DraftItem): number {
  const qty = parseFloat(it.cantidad || "0");
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.round(qty * it.precioUnitarioCents);
}

/** El monto del trabajo: la suma de las piezas si hay, o el monto a mano. */
export function workDraftCents(d: WorkDraft): number {
  if (d.items.length > 0) return d.items.reduce((s, it) => s + itemSubtotalCents(it), 0);
  return d.amountMode === "area"
    ? lineAmountCents({ mt2: toNum(d.mt2), costPerMt2Cents: toCents(d.costPerMt2), flatAmountCents: 0 })
    : toCents(d.flatAmount);
}

/** ¿Hay alguna pieza sin cantidad? */
export function workDraftHasEmptyItem(d: WorkDraft): boolean {
  return d.items.some((it) => itemSubtotalCents(it) <= 0);
}

/** Lo que se manda al servidor. */
export function workDraftToInput(d: WorkDraft) {
  const area = d.items.length === 0 && d.amountMode === "area";
  return {
    amountCents: workDraftCents(d),
    mt2: area ? toNum(d.mt2) : null,
    costPerMt2Cents: area ? toCents(d.costPerMt2) : null,
    items: d.items.map((it) => ({
      laborRateId: it.laborRateId,
      descripcion: it.descripcion,
      detalle: it.detalle.trim() || null,
      fase: it.fase,
      unidad: it.unidad,
      precioUnitarioCents: it.precioUnitarioCents,
      cantidad: parseFloat(it.cantidad),
      subtotalCents: itemSubtotalCents(it),
    })),
  };
}

/** Siembra el borrador desde un movimiento ya guardado (con sus piezas). */
export function workDraftFrom(
  entry: { amountCents: number; mt2: number | null; costPerMt2Cents: number | null },
  items: ContractorLedgerEntryItem[]
): WorkDraft {
  const area = entry.mt2 != null && entry.costPerMt2Cents != null;
  return {
    items: items.map((it) => ({
      key: it.id,
      laborRateId: it.laborRateId,
      descripcion: it.descripcion,
      detalle: it.detalle ?? "",
      fase: it.fase,
      unidad: it.unidad,
      precioUnitarioCents: it.precioUnitarioCents,
      cantidad: String(it.cantidad),
    })),
    amountMode: area ? "area" : "flat",
    flatAmount: area || items.length > 0 ? "" : (entry.amountCents / 100).toFixed(2),
    mt2: entry.mt2 != null ? String(entry.mt2) : "",
    costPerMt2: entry.costPerMt2Cents != null ? (entry.costPerMt2Cents / 100).toFixed(2) : "",
  };
}

const NO_ITEM_PICKED = "";

/**
 * Editor de piezas (desde el catálogo de tarifas) y del monto. Con al menos
 * una pieza, el monto es la suma de las piezas; sin piezas, se pone a mano
 * (fijo o m² × costo/m²).
 */
export function WorkEditor({
  draft,
  onChange,
  rates,
  showItems = true,
}: {
  draft: WorkDraft;
  onChange: (next: WorkDraft) => void;
  /** Tarifas activas del tipo de este contratista. */
  rates: LaborRate[];
  /** false = solo el monto a mano (sin piezas). */
  showItems?: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const [itemPicker, setItemPicker] = React.useState(NO_ITEM_PICKED);
  // Pieza cuyo "Detalle" está en edición — las demás se ven en solo lectura.
  const [editingDetailKey, setEditingDetailKey] = React.useState<string | null>(null);

  const items = draft.items;
  const hasItems = showItems && items.length > 0;
  const totalCents = workDraftCents(draft);
  const setItems = (fn: (cur: DraftItem[]) => DraftItem[]) => onChange({ ...draft, items: fn(draft.items) });

  function onPickItem(rateId: string) {
    const rate = rates.find((r) => r.id === rateId);
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

  const unitLabel = (u: LaborRateUnit) => (u === "m2" ? tt("unit_m2") : u === "ml" ? tt("unit_ml") : tt("unit_unidad"));
  const phaseLabel = (f: LaborRatePhase | null) => (!f ? null : f === "armado" ? tt("phase_armado") : tt("phase_instalacion"));

  return (
    <>
      {showItems && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-muted-foreground">{tt("mov_items_title")}</span>

          <Select value={itemPicker} onValueChange={onPickItem}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={tt("mov_items_add_ph")} />
            </SelectTrigger>
            <SelectContent>
              {rates.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">{tt("mov_items_empty_catalog")}</div>
              ) : (
                rates.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.descripcion}
                    {r.fase ? ` — ${phaseLabel(r.fase)}` : ""} · {formatCents(r.precioCents)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {items.length > 0 && (
            <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-border">
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
                        {it.fase && <span className="text-muted-foreground"> — {phaseLabel(it.fase)}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {editingDetailKey === it.key ? (
                          <Input
                            value={it.detalle}
                            onChange={(e) =>
                              setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, detalle: e.target.value } : x)))
                            }
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
                            <span className="truncate text-muted-foreground">{it.detalle.trim() || "—"}</span>
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
                          onChange={(e) =>
                            setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, cantidad: e.target.value } : x)))
                          }
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
                          onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}
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
                      {formatCents(totalCents)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Monto: calculado desde las piezas (solo lectura) o a mano. */}
      {hasItems ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">{tt("mov_f_amount_mode")}</p>
            <p className="text-xs text-muted-foreground">{tt("mov_amount_from_items")}</p>
          </div>
          <span className="text-base font-semibold tabular-nums text-foreground">{formatCents(totalCents)}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{tt("mov_f_amount_mode")}:</span>
            <SegmentedFilter
              value={draft.amountMode}
              onChange={(m) => onChange({ ...draft, amountMode: m })}
              options={[
                { value: "flat" as const, label: tt("amount_mode_flat") },
                { value: "area" as const, label: tt("amount_mode_area") },
              ]}
            />
          </div>

          {draft.amountMode === "flat" ? (
            <Field label={tt("mov_f_flat")}>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={draft.flatAmount}
                onChange={(e) => onChange({ ...draft, flatAmount: e.target.value })}
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
                    value={draft.mt2}
                    onChange={(e) => onChange({ ...draft, mt2: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label={tt("mov_f_cost_mt2")}>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={draft.costPerMt2}
                    onChange={(e) => onChange({ ...draft, costPerMt2: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                {tt("mov_computed")}:{" "}
                <span className="font-medium text-foreground tabular-nums">{formatCents(totalCents)}</span>
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
