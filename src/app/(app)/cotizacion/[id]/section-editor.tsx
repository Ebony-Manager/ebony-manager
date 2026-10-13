"use client";

import * as React from "react";
import { ChevronRight, Plus } from "lucide-react";

import { formatMoney, newFreeLine, newLine, sectionTotals, swapLineItem } from "@/lib/cotizador/pricing";
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

type BlockKey = "eb" | "sb" | "ex" | "mg";

// Cada bloque tiene su color de encabezado y un fondo muy tenue del mismo
// tono, para saber de un vistazo en qué parte del ítem se está trabajando.
const BLOCK_STYLE: Record<BlockKey, { head: string; body: string; rule: string }> = {
  eb: { head: "bg-cream-100", body: "bg-[color-mix(in_srgb,var(--cream-100)_38%,white)]", rule: "border-[color-mix(in_srgb,var(--walnut)_22%,white)]" },
  sb: { head: "bg-[color-mix(in_srgb,var(--status-ok)_16%,white)]", body: "bg-[color-mix(in_srgb,var(--status-ok)_5%,white)]", rule: "border-[color-mix(in_srgb,var(--status-ok)_24%,white)]" },
  ex: { head: "bg-[color-mix(in_srgb,var(--status-error)_14%,white)]", body: "bg-[color-mix(in_srgb,var(--status-error)_4%,white)]", rule: "border-[color-mix(in_srgb,var(--status-error)_22%,white)]" },
  mg: { head: "bg-stone-200", body: "bg-[color-mix(in_srgb,var(--stone-200)_32%,white)]", rule: "border-stone-400/60" },
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
      className="w-full resize-none overflow-hidden border border-input bg-card px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
    />
  );
}

export function SectionEditor({
  section,
  catalog,
  isAdmin,
  open,
  onToggle,
  onChange,
}: {
  section: QuoteSection;
  catalog: CatalogItem[];
  isAdmin: boolean;
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
  const removeLine = (id: string) =>
    setLines(section.lines.filter((l) => l.id !== id).map((l) => (l.hostLineId === id ? { ...l, hostLineId: null } : l)));

  const active = React.useMemo(() => catalog.filter((c) => c.active), [catalog]);
  const optionsFor = (l: QuoteLine) => {
    const list = active.filter((c) => c.category === l.category);
    const current = l.itemId ? catalog.find((c) => c.id === l.itemId) : undefined;
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
      isAdmin={isAdmin}
      onChange={(p) => patchLine(l.id, p)}
      onSwap={(item) => setLines(section.lines.map((x) => (x.id === l.id ? swapLineItem(x, item) : x)))}
      onRemove={() => removeLine(l.id)}
    />
  );

  const adder = (label: string, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick} className="inline-flex items-center gap-1 border border-input bg-card px-2 py-1 text-xs font-medium hover:border-ink-700">
      <Plus className="size-3" />
      {label}
    </button>
  );

  const block = (key: BlockKey, title: string, summary: string, body: React.ReactNode) => {
    const st = BLOCK_STYLE[key];
    return (
      <section key={key} className={cn("border", st.rule, st.body)}>
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
            {ebony.map(row)}
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {EBONY_ADDERS.filter(hasCategory).map((c) => adder(tt(`cat_${c}`), () => addLine(c)))}
              {adder(tt("cat_libre"), () => setLines([...section.lines, newFreeLine(crypto.randomUUID())]))}
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
            <div className="mt-0.5 flex flex-wrap gap-1.5">{SUB_CATEGORIES.filter(hasCategory).map((c) => adder(tt(`cat_${c}`), () => addLine(c)))}</div>
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
