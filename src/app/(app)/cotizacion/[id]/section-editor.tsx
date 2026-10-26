"use client";

import * as React from "react";
import { ChevronRight, Plus } from "lucide-react";

import { formatMoney, golaItemFor, isGolaItem, lineAmount, newFreeLine, newLine, sectionTotals, swapLineItem } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  SECTION_KINDS,
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

type BlockKey = "eb" | "sb" | "ex" | "mg";

// Cada bloque tiene su color de encabezado y un fondo tenue del mismo tono,
// para saber de un vistazo en qué parte del ítem se está trabajando. Los
// tonos se mezclan con el color de tarjeta del tema (no con blanco), así se
// ven bien también en modo oscuro. Renglones Ebony va en amarillo: es el
// bloque principal y no debe confundirse con el azul del tema.
// (Clases escritas completas: Tailwind no reconoce clases armadas con variables.)
const BLOCK_STYLE: Record<BlockKey, { head: string; body: string; rule: string; group: string }> = {
  eb: {
    head: "bg-[color-mix(in_srgb,#e9b949_48%,var(--card))]",
    body: "bg-[color-mix(in_srgb,#e9b949_18%,var(--card))]",
    rule: "border-[color-mix(in_srgb,#e9b949_70%,var(--card))]",
    group: "text-[color-mix(in_srgb,#b8860b_75%,var(--foreground))]",
  },
  sb: {
    head: "bg-[color-mix(in_srgb,var(--status-ok)_22%,var(--card))]",
    body: "bg-[color-mix(in_srgb,var(--status-ok)_7%,var(--card))]",
    rule: "border-[color-mix(in_srgb,var(--status-ok)_35%,var(--card))]",
    group: "text-[color-mix(in_srgb,var(--status-ok)_70%,var(--foreground))]",
  },
  ex: {
    head: "bg-[color-mix(in_srgb,var(--status-error)_16%,var(--card))]",
    body: "bg-[color-mix(in_srgb,var(--status-error)_5%,var(--card))]",
    rule: "border-[color-mix(in_srgb,var(--status-error)_28%,var(--card))]",
    group: "text-muted-foreground",
  },
  mg: {
    head: "bg-[color-mix(in_srgb,var(--muted-foreground)_18%,var(--card))]",
    body: "bg-[color-mix(in_srgb,var(--muted-foreground)_6%,var(--card))]",
    rule: "border-[color-mix(in_srgb,var(--muted-foreground)_28%,var(--card))]",
    group: "text-muted-foreground",
  },
};
/** Orden de los grupos dentro de un bloque. */
const GROUP_ORDER: CatalogCategory[] = ["modulos", "puertas", "gavetas", "tablillas", "revestimientos", "accesorios", "libre", "espejos", "vidrios", "metales", "tapiceria", "iluminacion"];

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
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      className="w-full resize-none overflow-hidden rounded-md border border-input bg-card px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
    />
  );
}

export function SectionEditor({
  section,
  catalog,
  canEditCosts,
  open,
  onToggle,
  onChange,
  selectedLineId = null,
  onSelectLine,
  assigningLineId = null,
  onAssign,
}: {
  /** Renglón al que se le están asignando piezas en el dibujo. */
  assigningLineId?: string | null;
  /** Solo en ítems leídos de plano: entra o sale del modo asignar piezas. */
  onAssign?: (lineId: string | null) => void;
  section: QuoteSection;
  selectedLineId?: string | null;
  onSelectLine?: (id: string) => void;
  catalog: CatalogItem[];
  canEditCosts: boolean;
  open: Record<BlockKey, boolean>;
  onToggle: (key: BlockKey) => void;
  onChange: (next: QuoteSection) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const [unlocked, setUnlocked] = React.useState<Record<BlockKey, boolean>>({ eb: false, sb: false, ex: false, mg: false });

  const totals = sectionTotals(section);
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
      selected={selectedLineId === l.id}
      onSelect={onSelectLine ? () => onSelectLine(l.id) : undefined}
      grouped
      assigning={assigningLineId === l.id}
      onAssign={onAssign ? () => onAssign(assigningLineId === l.id ? null : l.id) : undefined}
      gola={golaItemFor(catalog, l)}
    />
  );

  // Renglones agrupados por categoría, cada grupo con su subtítulo.
  const grouped = (list: QuoteLine[], key: BlockKey) =>
    GROUP_ORDER.filter((c) => list.some((l) => l.category === c)).map((c) => {
      const items = list.filter((l) => l.category === c);
      return (
        <div key={c} className="flex flex-col gap-1.5">
          <p className={cn("mt-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase", BLOCK_STYLE[key].group)}>
            {tt(`grp_${c}`)}
            <span className={cn("h-px flex-1", BLOCK_STYLE[key].rule, "border-t")} />
            <span className="font-medium tracking-normal normal-case tabular-nums">{formatMoney(items.reduce((s, l) => s + lineAmount(l), 0))}</span>
          </p>
          {items.map(row)}
        </div>
      );
    });


  // "Vaciar" el bloque: todos sus renglones, en dos toques.
  const clearer = (lines: QuoteLine[]) =>
    lines.length > 0 && (
      <ConfirmButton className="ml-auto h-7" label={tt("block_clear")} confirmLabel={tt("block_clear_confirm")} onConfirm={() => removeLines(new Set(lines.map((l) => l.id)))} />
    );

  const adder = (label: string, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-medium hover:border-ink-700">
      <Plus className="size-3" />
      {label}
    </button>
  );

  const block = (key: BlockKey, title: string, summary: string, body: React.ReactNode) => {
    const st = BLOCK_STYLE[key];
    return (
      <section key={key} className={cn("rounded-lg overflow-hidden border", st.rule, st.body)}>
        <button type="button" aria-expanded={open[key]} onClick={() => onToggle(key)} className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left", st.head)}>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
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
  type NumKey = "utilPct" | "subMarginPct" | "wasteSheets" | "wastePct" | "design3d" | "extraLabor" | "freight" | "commissionPct" | "ccfPct";
  const kv = (blockKey: BlockKey, field: NumKey, label: string, unit: "%" | "$" | "u") => (
    <div key={`${blockKey}-${field}`} className={cn("flex min-h-[30px] items-center justify-between gap-3 border-b text-xs text-ink-700", BLOCK_STYLE[blockKey].rule)}>
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
      className="text-[11px] text-muted-foreground underline decoration-ink-900/16 hover:text-foreground"
    >
      {unlocked[blockKey] ? tt("done") : tt("edit")}
    </button>
  );

  const fieldLabel = "flex min-w-0 flex-col gap-1 text-[11px] font-medium text-ink-700";
  const fieldInput = "h-8 w-full min-w-0 border border-input bg-card px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,150px)]">
        <label className={fieldLabel}>
          {tt("sec_location")}
          <input className={fieldInput} value={section.location} placeholder={tt("sec_location_ph")} onChange={(e) => patch({ location: e.currentTarget.value })} />
        </label>
        <label className={fieldLabel}>
          {tt("sec_name")}
          <input className={fieldInput} value={section.name} placeholder={tt("sec_name_ph")} onChange={(e) => patch({ name: e.currentTarget.value })} />
        </label>
        <label className={cn(fieldLabel, "col-span-2 md:col-span-1")}>
          {tt("sec_kind")}
          <select className={fieldInput} value={section.kind} onChange={(e) => patch({ kind: e.currentTarget.value })}>
            {SECTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className={cn(fieldLabel, "col-span-2 md:col-span-3")}>
          {tt("sec_description")}
          <AutoTextarea value={section.description} onChange={(v) => patch({ description: v })} placeholder={tt("sec_description_ph")} />
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        {block(
          "eb",
          tt("block_ebony"),
          formatMoney(totals.ebony),
          <>
            {ebony.length === 0 && <p className="text-xs text-muted-foreground">{tt("block_ebony_empty")}</p>}
            {grouped(ebony, "eb")}
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
            {grouped(subs, "sb")}
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
              <details className="text-[11px] text-ink-700">
                <summary className="cursor-pointer text-muted-foreground underline decoration-ink-900/16">{tt("waste_calc")}</summary>
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
            {kv("mg", "commissionPct", tt("f_commission"), "%")}
            {kv("mg", "ccfPct", tt("f_ccf"), "%")}
            <div className="flex items-start justify-between gap-3 pt-1.5">
              <span className="text-[11px] text-muted-foreground">{tt("margins_note")}</span>
              {editLink("mg")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { BlockKey };
