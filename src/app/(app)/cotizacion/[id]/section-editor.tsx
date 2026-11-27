"use client";

import * as React from "react";
import { ChevronRight, Plus } from "lucide-react";

import { formatMoney, golaItemFor, isGolaItem, newFreeLine, newLine, sectionTotals, swapLineItem , type QuoteRates } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  SUB_CATEGORIES,
  isSubcontract,
  type CatalogCategory,
  type CatalogItem,
  type QuoteLine,
  type QuoteSection,
} from "@/types/cotizador";
import { NumField } from "../num-field";
import { LineRow } from "./line-row";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Input } from "@/components/ui/input";
import { Field, useField } from "@/components/shared/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { locationKey } from "@/lib/cotizador/items";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { round2 } from "@/lib/cotizador/pricing";
import type { ItemPriceMode } from "@/types/cotizador";

type BlockKey = "eb" | "sb" | "ex" | "mg";

// Cada bloque tiene su color de encabezado y un fondo muy tenue del mismo
// tono, para saber de un vistazo en qué parte del ítem se está trabajando.
const BLOCK_STYLE: Record<BlockKey, { head: string; body: string; rule: string }> = {
  // Renglones Ebony en amarillo, un poco más fuerte que el resto: es el
  // bloque principal y con el tema azul el tono crema se perdía. Se mezcla
  // con el color de tarjeta del tema para que funcione en modo oscuro.
  eb: {
    head: "bg-[color-mix(in_oklab,var(--status-warn)_48%,var(--card))]",
    body: "bg-[color-mix(in_oklab,var(--status-warn)_18%,var(--card))]",
    rule: "border-[color-mix(in_oklab,var(--status-warn)_70%,var(--card))]",
  },
  sb: { head: "bg-[color-mix(in_oklab,var(--status-ok)_16%,var(--card))]", body: "bg-[color-mix(in_oklab,var(--status-ok)_5%,var(--card))]", rule: "border-[color-mix(in_oklab,var(--status-ok)_24%,var(--card))]" },
  ex: { head: "bg-[color-mix(in_oklab,var(--status-error)_14%,var(--card))]", body: "bg-[color-mix(in_oklab,var(--status-error)_4%,var(--card))]", rule: "border-[color-mix(in_oklab,var(--status-error)_22%,var(--card))]" },
  mg: { head: "bg-muted", body: "bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]", rule: "border-border" },
};

/** El ítem con el que nace un renglón al pulsar "+ Revestimiento", etc. */
const PREFERRED: Partial<Record<CatalogCategory, string>> = {
  revestimientos: "rev-pi",
  modulos: "mod-ag",
  tablillas: "tab-ag",
  gavetas: "gav-fr-pi",
  puertas: "pta-pi",
  accesorios: "ac-tir",
  espejos: "sb-esp-g",
  vidrios: "sb-vid-10",
  metales: "sb-est",
  tapiceria: "sb-coj",
  iluminacion: "sb-led",
};
const EBONY_ADDERS: CatalogCategory[] = ["revestimientos", "modulos", "tablillas", "gavetas", "puertas", "accesorios"];

/** Área de texto que crece con su contenido: nunca corta la descripción. */
function AutoTextarea({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void; id?: string; placeholder?: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const field = useField();
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      id={field?.id}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      {...rest}
      ref={ref}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      className="w-full resize-none overflow-hidden rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
    />
  );
}

export function SectionEditor({
  section,
  rates,
  catalog,
  canEditCosts,
  open,
  onToggle,
  onChange,
  locations = [],
  extra,
  kinds,
}: {
  /** Los tipos de ítem que se ofrecen (Settings → Cotizaciones). */
  kinds: readonly string[];
  /** Va debajo de la descripción (las imágenes del ítem). */
  extra?: React.ReactNode;
  /** Ubicaciones ya usadas en la cotización (se ofrecen al escribir). */
  locations?: string[];
  section: QuoteSection;
  /** Comisión y recargo de tarjeta de la cotización (los precios del ítem los llevan adentro). */
  rates: QuoteRates;
  catalog: CatalogItem[];
  canEditCosts: boolean;
  open: Record<BlockKey, boolean>;
  onToggle: (key: BlockKey) => void;
  onChange: (next: QuoteSection) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const [unlocked, setUnlocked] = React.useState<Record<BlockKey, boolean>>({ eb: false, sb: false, ex: false, mg: false });

  const totals = sectionTotals(section, rates);
  const patch = (p: Partial<QuoteSection>) => onChange({ ...section, ...p });
  const setLines = (lines: QuoteLine[]) => onChange({ ...section, lines });
  const patchLine = (id: string, p: Partial<QuoteLine>) => setLines(section.lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  // Al quitar renglones, los que iban montados sobre ellos (hostLineId) quedan sueltos.
  const removeLines = (ids: Set<string>) =>
    setLines(section.lines.filter((l) => !ids.has(l.id)).map((l) => (l.hostLineId && ids.has(l.hostLineId) ? { ...l, hostLineId: null } : l)));
  const removeLine = (id: string) => removeLines(new Set([id]));

  const active = React.useMemo(() => catalog.filter((c) => c.active), [catalog]);
  const optionsFor = (l: QuoteLine) => {
    const current = l.itemId ? catalog.find((c) => c.id === l.itemId) : undefined;
    // La gola se agrega dentro de la puerta o gaveta, así que no se ofrece
    // como renglón (salvo en cotizaciones viejas que ya la tienen aparte).
    const golaLine = !!current && isGolaItem(current);
    const list = active.filter((c) => c.category === l.category && isGolaItem(c) === golaLine);
    return current && !current.active ? [current, ...list] : list;
  };
  const addLine = (category: CatalogCategory) => {
    const list = active.filter((c) => c.category === category);
    const item = list.find((c) => c.code === PREFERRED[category]) ?? list[0];
    if (item) setLines([...section.lines, newLine(crypto.randomUUID(), item)]);
  };
  const hasCategory = (category: CatalogCategory) => active.some((c) => c.category === category);

  const ebony = section.lines.filter((l) => !isSubcontract(l.category));
  const subs = section.lines.filter((l) => isSubcontract(l.category));

  const row = (l: QuoteLine) => (
    <LineRow
      key={l.id}
      line={l}
      options={optionsFor(l)}
      cornerMode={section.wallShape === "L"}
      canEditCosts={canEditCosts}
      onChange={(p) => patchLine(l.id, p)}
      onSwap={(item) =>
        setLines(
          section.lines.map((x) => {
            if (x.id !== l.id) return x;
            const next = swapLineItem(x, item);
            // Al cambiar de acabado, la gola toma el precio del acabado nuevo.
            const g = next.golaMl > 0 ? golaItemFor(catalog, next) : null;
            return next.golaMl > 0 ? { ...next, golaMl: g ? next.golaMl : 0, golaPrice: g ? g.price : 0 } : next;
          })
        )
      }
      onRemove={() => removeLine(l.id)}
      gola={golaItemFor(catalog, l)}
    />
  );

  // "Vaciar" el bloque: todos sus renglones, en dos toques.
  const clearer = (lines: QuoteLine[]) =>
    lines.length > 0 && (
      <ConfirmButton className="ml-auto h-7" label={tt("block_clear")} confirmLabel={tt("block_clear_confirm")} onConfirm={() => removeLines(new Set(lines.map((l) => l.id)))} />
    );

  const adder = (label: string, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-medium hover:bg-muted/40">
      <Plus className="size-3" />
      {label}
    </button>
  );

  const block = (key: BlockKey, title: string, summary: string, body: React.ReactNode) => {
    const st = BLOCK_STYLE[key];
    return (
      <section key={key} className={cn("rounded-lg overflow-hidden border", st.rule, st.body)}>
        <button type="button" aria-expanded={open[key]} onClick={() => onToggle(key)} className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left", st.head)}>
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <ChevronRight className={cn("size-3.5 transition-transform", open[key] && "rotate-90")} />
            {title}
          </span>
          <span className="text-xs font-semibold tabular-nums">{summary}</span>
        </button>
        {open[key] && <div className="flex flex-col gap-2 p-2.5">{body}</div>}
      </section>
    );
  };

  // Lista "etiqueta … valor" para los valores fijos: bloqueados hasta "Editar".
  type NumKey = "utilPct" | "subMarginPct" | "wasteSheets" | "wastePct" | "design3d" | "extraLabor" | "freight";
  const kv = (blockKey: BlockKey, field: NumKey, label: string, unit: "%" | "$" | "u") => (
    <div key={`${blockKey}-${field}`} className={cn("flex min-h-[30px] items-center justify-between gap-3 border-b text-xs text-foreground/80", BLOCK_STYLE[blockKey].rule)}>
      <span>{label}</span>
      <NumField
        value={section[field]}
        onChange={(n) => patch({ [field]: n })}
        prefix={unit === "$" ? "$" : undefined}
        suffix={unit === "$" ? undefined : unit}
        locked={!unlocked[blockKey]}
        inputWidth={46}
        aria-label={label}
      />
    </div>
  );
  const editLink = (blockKey: BlockKey) => (
    <button
      type="button"
      onClick={() => setUnlocked((u) => ({ ...u, [blockKey]: !u[blockKey] }))}
      className="text-[11px] text-muted-foreground underline decoration-border hover:text-foreground"
    >
      {unlocked[blockKey] ? tt("done") : tt("edit")}
    </button>
  );

  const direct = section.priceMode === "direct";
  // Al pasar a precio directo, arranca con el precio que tenía calculado (por unidad).
  const setMode = (mode: ItemPriceMode) =>
    patch(mode === "direct" && !(section.directPrice > 0) ? { priceMode: mode, directPrice: round2(totals.unit) } : { priceMode: mode });

  const discountField = (
        <Field label={tt("item_discount")}>
          <span className="inline-flex h-9 items-center rounded-md border border-input bg-card pr-0.5 pl-2 focus-within:border-ring">
            <NumField
              value={section.discountValue}
              onChange={(n) => patch({ discountValue: n > 0 ? n : 0 })}
              locked={false}
              inputWidth={56}
              className="h-auto border-0 bg-transparent px-0 shadow-none focus-within:ring-0"
              aria-label={tt("item_discount")}
            />
            <button
              type="button"
              title={tt("discount_toggle")}
              aria-label={tt("discount_toggle")}
              onClick={() => patch({ discountType: section.discountType === "pct" ? "amount" : "pct" })}
              className="ml-1 rounded bg-muted px-1.5 text-xs leading-[22px] text-foreground/80 hover:bg-accent"
            >
              {section.discountType === "pct" ? "%" : "$"}
            </button>
          </span>
        </Field>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <SegmentedFilter<ItemPriceMode>
        className="self-start"
        value={section.priceMode}
        onChange={setMode}
        options={[
          { value: "recipe", label: tt("mode_recipe") },
          { value: "direct", label: tt("mode_direct") },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_110px_minmax(0,150px)]">
        <Field label={tt("sec_location")}>
          <LocationInput value={section.location} options={locations} placeholder={tt("sec_location_ph")} onChange={(v) => patch({ location: v })} />
        </Field>
        <Field label={tt("sec_name")}>
          <Input value={section.name} placeholder={tt("sec_name_ph")} onChange={(e) => patch({ name: e.currentTarget.value })} />
        </Field>
        <Field label={tt("sec_qty")}>
          <NumField value={section.qty} onChange={(n) => patch({ qty: n > 0 ? n : 1 })} suffix="u" inputWidth={40} className="h-9 justify-between" aria-label={tt("sec_qty")} />
        </Field>
        <Field label={tt("sec_kind")}>
          <Select value={section.kind} onValueChange={(v) => patch({ kind: v })}>
            <SelectTrigger className="w-full" aria-label={tt("sec_kind")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Un tipo que ya no está en la lista (renombrado o quitado) se conserva en este ítem. */}
              {kinds.includes(section.kind) ? null : <SelectItem value={section.kind}>{section.kind}</SelectItem>}
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={tt("sec_description")} className="min-[480px]:col-span-2 md:col-span-4">
          <AutoTextarea value={section.description} onChange={(v) => patch({ description: v })} placeholder={tt("sec_description_ph")} />
        </Field>
      </div>
      {extra}

      {/* Descuento del ítem (lo ve el cliente). Con receta va en su bloque, con la casilla de comisión;
          con precio directo va junto al precio, en la misma caja. */}
      {!direct && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/30 p-3">
          {discountField}
          {rates.commissionPct > 0 && (
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-muted-foreground select-none">
              <input type="checkbox" className="size-3.5 accent-primary" checked={section.noCommission} onChange={(e) => patch({ noCommission: e.target.checked })} />
              {tt("item_no_commission")}
            </label>
          )}
        </div>
      )}

      {direct ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={tt("direct_price")}>
                <NumField
                  value={section.directPrice}
                  onChange={(n) => patch({ directPrice: n > 0 ? n : 0 })}
                  prefix="$"
                  inputWidth={96}
                  className="h-9 justify-between"
                  aria-label={tt("direct_price")}
                />
              </Field>
              {discountField}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {tt("direct_total")}
                {totals.qty > 1 ? ` (${formatMoney(totals.unit)} × ${totals.qty})` : ""}
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(totals.total)}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{tt("direct_note")}</p>
        </div>
      ) : (
      <div className="flex flex-col gap-2.5">
        {block(
          "eb",
          tt("block_ebony"),
          formatMoney(totals.ebony),
          <>
            {ebony.length === 0 && <p className="text-xs text-muted-foreground">{tt("block_ebony_empty")}</p>}
            {ebony.map(row)}
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {EBONY_ADDERS.filter(hasCategory).map((c) => adder(tt(`cat_${c}`), () => addLine(c)))}
              {adder(tt("cat_libre"), () => setLines([...section.lines, newFreeLine(crypto.randomUUID())]))}
              {clearer(ebony)}
            </div>
          </>
        )}

        {block(
          "sb",
          tt("block_subs"),
          formatMoney(totals.sub),
          <>
            {subs.length === 0 && <p className="text-xs text-muted-foreground">{tt("block_subs_empty")}</p>}
            {subs.map(row)}
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {SUB_CATEGORIES.filter(hasCategory).map((c) => adder(tt(`cat_${c}`), () => addLine(c)))}
              {clearer(subs)}
            </div>
            <div className="mt-1 max-w-[330px]">
              {kv("sb", "subMarginPct", tt("f_sub_margin"), "%")}
              <div className="flex justify-end pt-1.5">{editLink("sb")}</div>
            </div>
          </>
        )}

        {block(
          "ex",
          tt("block_extras"),
          formatMoney(totals.extras),
          <div className="max-w-[330px]">
            {kv("ex", "wasteSheets", tt("f_waste_sheets"), "u")}
            {kv("ex", "wastePct", tt("f_waste_pct"), "%")}
            {kv("ex", "design3d", tt("f_design3d"), "$")}
            {kv("ex", "extraLabor", tt("f_extra_labor"), "$")}
            {kv("ex", "freight", tt("f_freight"), "$")}
            <div className="flex items-start justify-between gap-3 pt-1.5">
              <details className="text-[11px] text-foreground/80">
                <summary className="cursor-pointer text-muted-foreground underline decoration-border">{tt("waste_calc")}</summary>
                <p className="mt-1.5 tabular-nums">
                  {section.wasteSheets} × {formatMoney(section.wasteSheetPrice)} × {section.wastePct}% = {formatMoney(totals.waste)}
                </p>
                <p className="mt-0.5 text-muted-foreground">{tt("waste_calc_note")}</p>
              </details>
              {editLink("ex")}
            </div>
          </div>
        )}

        {block(
          "mg",
          tt("block_margins"),
          "",
          <div className="max-w-[330px]">
            {kv("mg", "utilPct", tt("f_util"), "%")}
            {kv("mg", "subMarginPct", tt("f_sub_margin"), "%")}
            <div className="flex items-start justify-between gap-3 pt-1.5">
              <span className="text-[11px] text-muted-foreground">{tt("margins_note")}</span>
              {editLink("mg")}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/**
 * Ubicación: se escribe libre, pero al escribir se ofrecen las que ya están
 * en la cotización ("Rec #8"), para no tener la misma escrita de dos formas.
 */
function LocationInput({ id, value, options, placeholder, onChange }: { id?: string; value: string; options: string[]; placeholder: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const key = locationKey(value);
  const shown = options.filter((o) => locationKey(o) !== key && (!key || locationKey(o).includes(key))).slice(0, 8);
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          setOpen(true);
        }}
      />
      {open && shown.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md">
          {shown.map((o) => (
            <li key={o}>
              <button
                type="button"
                // mousedown: antes de que el campo pierda el foco.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setOpen(false);
                }}
                className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { BlockKey };
