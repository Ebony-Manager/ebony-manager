"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/cotizador/pricing";
import { inputValues, recipeParts } from "@/lib/cotizador/recipes";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  EBONY_CATEGORIES,
  SUB_CATEGORIES,
  type CatalogCategory,
  type CatalogItem,
  type CostInput,
  type Finish,
  type Recipe,
  type Shape,
  type Unit,
} from "@/types/cotizador";
import { createCatalogItemAction, updateCatalogItemAction, updateCostInputAction } from "../actions";
import { NumField } from "../num-field";

const CATEGORIES = [...EBONY_CATEGORIES.filter((c) => c !== "libre"), ...SUB_CATEGORIES] as CatalogCategory[];
const UNIT_LABEL: Record<Unit, string> = { m2: "m²", ml: "ML", unidad: "u" };
/** Forma del dibujo 3D con la que nace un renglón nuevo, según su categoría. */
const DEFAULT_SHAPE: Partial<Record<CatalogCategory, Shape>> = { modulos: "mod", tablillas: "tab", puertas: "pta", revestimientos: "rev", espejos: "esp", vidrios: "vid" };

function inputAffix(unit: string): { prefix?: string; suffix?: string } {
  if (unit.startsWith("usd")) return { prefix: "$", suffix: unit === "usd_ml" ? "/ML" : unit === "usd_m2" ? "/m²" : undefined };
  if (unit === "pct") return { suffix: "%" };
  if (unit === "m2") return { suffix: "m²" };
  if (unit === "dias") return { suffix: "d" };
  return { suffix: unit };
}

/**
 * Costos (solo admin). Tres piezas:
 *  - Catálogo: junto a cada renglón, lo que da el cálculo y el precio con
 *    el que se cotiza. Si no coinciden se ve la diferencia, para ajustar
 *    la receta o fijar el precio.
 *  - Insumos y valores fijos de la empresa.
 *  - El desglose del renglón seleccionado.
 * Los cambios se ven al instante y se guardan al salir de la casilla.
 */
export function CostosClient({
  initialCatalog,
  initialInputs,
  recipes,
  initialItemId,
}: {
  initialCatalog: CatalogItem[];
  initialInputs: CostInput[];
  recipes: Recipe[];
  initialItemId: string | null;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);

  const [catalog, setCatalog] = React.useState(initialCatalog);
  const [inputs, setInputs] = React.useState(initialInputs);
  const [selected, setSelected] = React.useState<string | null>(initialItemId ?? initialCatalog[0]?.id ?? null);
  const [showInactive, setShowInactive] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<{ name: string; category: CatalogCategory; finish: Finish | ""; unit: Unit; price: number }>({
    name: "",
    category: "revestimientos",
    finish: "",
    unit: "m2",
    price: 0,
  });

  const selectedRow = React.useRef<HTMLTableRowElement>(null);
  React.useEffect(() => {
    if (initialItemId) selectedRow.current?.scrollIntoView({ block: "center" });
  }, [initialItemId]);

  const ins = React.useMemo(() => inputValues(inputs), [inputs]);
  const recipeOf = React.useMemo(() => new Map(recipes.map((r) => [r.itemId, r])), [recipes]);
  const calc = (item: CatalogItem) => {
    const r = recipeOf.get(item.id);
    return r ? recipeParts(r, ins).perUnit : null;
  };

  const persist = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };
  const patchItem = (id: string, p: Partial<CatalogItem>) => setCatalog((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const inputLabel = (i: CostInput) => {
    const key = `in_${i.key}` as keyof typeof strings.cotizador;
    return key in strings.cotizador ? tt(key) : i.label;
  };

  async function onAdd() {
    if (!draft.name.trim()) return;
    try {
      const created = await createCatalogItemAction({
        name: draft.name.trim(),
        category: draft.category,
        finish: draft.finish || null,
        unit: draft.unit,
        price: draft.price,
        shape: DEFAULT_SHAPE[draft.category] ?? "none",
      });
      setCatalog((list) => [...list, created]);
      setSelected(created.id);
      setAdding(false);
      setDraft((d) => ({ ...d, name: "", price: 0 }));
      toast.success(tt("cost_item_added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  const current = catalog.find((c) => c.id === selected) ?? null;
  const currentRecipe = current ? recipeOf.get(current.id) : undefined;
  const parts = currentRecipe ? recipeParts(currentRecipe, ins) : null;

  const panel = "border border-ink-900/8 bg-card";
  const panelTitle = "border-b border-ink-900/8 px-3.5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-walnut uppercase";
  const formInput = "h-8 min-w-0 border border-input bg-card px-2 text-[13px] outline-none focus-visible:border-ring";

  const inputList = (kind: CostInput["kind"]) =>
    inputs
      .filter((i) => i.kind === kind)
      .map((i) => (
        <div key={i.key} className="flex min-h-[32px] items-center justify-between gap-3 border-b border-ink-900/8 text-xs text-ink-700 last:border-0">
          <span>{inputLabel(i)}</span>
          <NumField
            value={i.value}
            onChange={(n) => setInputs((list) => list.map((x) => (x.key === i.key ? { ...x, value: n } : x)))}
            onCommit={() => persist(() => updateCostInputAction(i.key, inputs.find((x) => x.key === i.key)?.value ?? i.value))}
            {...inputAffix(i.unit)}
            inputWidth={56}
            aria-label={inputLabel(i)}
          />
        </div>
      ));

  const recipeRow = (label: string, value: string, strong = false) => (
    <div key={label} className={cn("flex justify-between gap-3", strong && "mt-1 border-t border-ink-900/8 pt-2 text-base font-bold")}>
      <span className={strong ? "" : "text-ink-700"}>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-12 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/cotizacion" className="inline-flex items-center gap-1.5 text-sm text-ink-900/50 hover:text-ink-900">
            <ArrowLeft className="size-3.5" />
            {tt("title")}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{tt("cost_title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("cost_subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? `✓ ${tt("cost_show_inactive")}` : tt("cost_show_inactive")}
          </Button>
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-3.5" />
            {tt("cost_add_item")}
          </Button>
        </div>
      </div>

      {adding && (
        <div className={cn(panel, "flex flex-wrap items-end gap-2.5 p-3.5")}>
          <label className="flex min-w-0 flex-[2_1_220px] flex-col gap-1 text-[11px] font-medium text-ink-700">
            {tt("cost_col_item")}
            <input autoFocus className={formInput} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-700">
            {tt("cost_col_category")}
            <select className={formInput} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.currentTarget.value as CatalogCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tt(`cat_${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-700">
            {tt("cost_col_finish")}
            <select className={formInput} value={draft.finish} onChange={(e) => setDraft({ ...draft, finish: e.currentTarget.value as Finish | "" })}>
              <option value="">—</option>
              {(["aglomerado", "blanco", "pintado", "chapilla"] as const).map((f) => (
                <option key={f} value={f}>
                  {tt(`finish_${f}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-700">
            {tt("cost_col_unit")}
            <select className={formInput} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.currentTarget.value as Unit })}>
              {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-700">
            {tt("cost_col_quote_price")}
            <NumField value={draft.price} onChange={(n) => setDraft({ ...draft, price: n })} prefix="$" inputWidth={64} className="h-8" />
          </label>
          <Button size="sm" onClick={onAdd} disabled={!draft.name.trim()}>
            {tt("cost_add_confirm")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className={cn(panel, "overflow-x-auto")}>
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/16 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left font-semibold">{tt("cost_col_item")}</th>
                <th className="px-3 py-2 text-left font-semibold">{tt("cost_col_unit")}</th>
                <th className="px-3 py-2 text-right font-semibold">{tt("cost_col_calc")}</th>
                <th className="px-3 py-2 text-right font-semibold">{tt("cost_col_quote_price")}</th>
                <th className="px-3 py-2 text-left font-semibold">{tt("cost_col_diff")}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const rows = catalog.filter((c) => c.category === cat && (showInactive || c.active));
                if (rows.length === 0) return null;
                return (
                  <React.Fragment key={cat}>
                    <tr>
                      <td colSpan={6} className="bg-cream-100/60 px-3 py-1.5 text-xs font-semibold text-walnut">
                        {tt(`cat_${cat}`)}
                      </td>
                    </tr>
                    {rows.map((c) => {
                      const k = calc(c);
                      const diff = k === null ? null : c.price - k;
                      const isSel = c.id === selected;
                      return (
                        <tr
                          key={c.id}
                          ref={isSel ? selectedRow : undefined}
                          aria-selected={isSel}
                          onClick={() => setSelected(c.id)}
                          className={cn("cursor-pointer border-b border-ink-900/8 last:border-0", isSel ? "bg-cream-100/70" : "hover:bg-muted/30", !c.active && "opacity-50")}
                        >
                          <td className="px-3 py-1.5">{c.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{UNIT_LABEL[c.unit]}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{k === null ? <span className="text-muted-foreground">—</span> : formatMoney(k)}</td>
                          <td className="px-3 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                            <NumField
                              value={c.price}
                              onChange={(n) => patchItem(c.id, { price: n })}
                              onCommit={() => persist(() => updateCatalogItemAction(c.id, { price: catalog.find((x) => x.id === c.id)?.price ?? c.price }))}
                              prefix="$"
                              inputWidth={64}
                              aria-label={`${tt("cost_col_quote_price")} — ${c.name}`}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            {diff === null ? (
                              <span className="text-xs text-muted-foreground">{tt("cost_no_recipe")}</span>
                            ) : Math.abs(diff) < 0.01 ? (
                              <span className="bg-[color-mix(in_srgb,var(--status-ok)_16%,white)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--status-ok)]">{tt("cost_match")}</span>
                            ) : (
                              <span className="bg-[color-mix(in_srgb,var(--status-error)_13%,white)] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[var(--status-error)] tabular-nums">
                                {diff > 0 ? "+" : "−"}
                                {formatMoney(Math.abs(diff))}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                patchItem(c.id, { active: !c.active });
                                void persist(() => updateCatalogItemAction(c.id, { active: !c.active }));
                              }}
                              className="text-[11px] text-muted-foreground underline decoration-ink-900/16 hover:text-foreground"
                            >
                              {c.active ? tt("cost_deactivate") : tt("cost_activate")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className={panel}>
            <h2 className={panelTitle}>{current ? current.name : tt("cost_recipe_title")}</h2>
            <div className="flex flex-col gap-1 p-3.5 text-sm">
              {!current ? (
                <p className="text-muted-foreground">{tt("cost_recipe_pick")}</p>
              ) : !currentRecipe || !parts ? (
                <p className="text-muted-foreground">{tt("cost_recipe_none")}</p>
              ) : (
                <>
                  {recipeRow(`${tt("rc_material")}: ${currentRecipe.usableM2} m² × ${formatMoney(parts.sheetPricePerM2)}`, formatMoney(parts.material))}
                  {currentRecipe.edgeMl > 0 && recipeRow(`${tt("rc_edge")}: ${currentRecipe.edgeMl} ML × ${formatMoney(ins[currentRecipe.edgeKey] ?? 0)}`, formatMoney(parts.edge))}
                  {currentRecipe.paint.map(([m2, key], i) =>
                    recipeRow(`${tt("rc_paint")} ${currentRecipe.paint.length > 1 ? i + 1 : ""}: ${m2} m² × ${formatMoney(ins[key] ?? 0)}`, formatMoney(m2 * (ins[key] ?? 0)))
                  )}
                  {recipeRow(tt("rc_labor"), formatMoney(currentRecipe.labor))}
                  {currentRecipe.hardwarePct > 0 && recipeRow(`${tt("rc_hardware")} ${(currentRecipe.hardwarePct * 100).toLocaleString("en-US")}%`, formatMoney(parts.hardware))}
                  {currentRecipe.fixed > 0 && recipeRow(currentRecipe.fixedLabel ?? tt("rc_fixed"), formatMoney(currentRecipe.fixed))}
                  <div className="mt-1 flex justify-between gap-3 border-t border-ink-900/8 pt-2 text-xs text-ink-700">
                    <span>
                      {tt("rc_piece_cost")}
                      {currentRecipe.baseM2 !== 1 && ` ÷ ${currentRecipe.baseM2} m²`}
                    </span>
                    <span className="tabular-nums">{formatMoney(parts.total)}</span>
                  </div>
                  {recipeRow(`${tt("cost_col_calc")} / ${UNIT_LABEL[current.unit]}`, formatMoney(parts.perUnit), true)}
                  <div className="flex justify-between gap-3 text-xs text-ink-700">
                    <span>{tt("cost_col_quote_price")}</span>
                    <span className="tabular-nums">{formatMoney(current.price)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={panel}>
            <h2 className={panelTitle}>{tt("cost_inputs_title")}</h2>
            <div className="px-3.5 py-2">{inputList("insumo")}</div>
            <p className="border-t border-ink-900/8 px-3.5 py-2.5 text-xs text-muted-foreground">{tt("cost_inputs_note")}</p>
          </div>

          <div className={panel}>
            <h2 className={panelTitle}>{tt("cost_defaults_title")}</h2>
            <div className="px-3.5 py-2">{inputList("default")}</div>
            <p className="border-t border-ink-900/8 px-3.5 py-2.5 text-xs text-muted-foreground">{tt("cost_defaults_note")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
