"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, Pencil, X } from "lucide-react";

import { formatMoney, golaAmount, lineAmount, lineQty } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { CatalogItem, Finish, QuoteLine, Unit } from "@/types/cotizador";
import { NumField } from "../num-field";
import { ConfirmButton } from "@/components/shared/confirm-button";

const ON_WALL = ["rev", "rev2", "rev55", "mod", "esp"];
const FINISHES: (Finish | null)[] = ["aglomerado", "blanco", "pintado", "chapilla", null];
export const UNIT_LABEL: Record<Unit, string> = { m2: "m²", ml: "ML", unidad: "u" };

/**
 * Un renglón de la cotización. El título gris de arriba dice su
 * categoría y el desplegable solo ofrece los ítems de esa categoría,
 * agrupados por acabado. Lo que se registra (medidas o cantidad) es lo
 * que más se ve; el precio del catálogo va discreto, y solo se ajusta
 * para esta cotización si se pulsa el lápiz.
 */
export function LineRow({
  line,
  options,
  cornerMode,
  canEditCosts,
  onChange,
  onSwap,
  onRemove,
  gola = null,
}: {
  line: QuoteLine;
  /** La gola del catálogo que le toca a esta puerta o gaveta (null si no aplica). */
  gola?: CatalogItem | null;
  /** Ítems activos de la misma categoría que el renglón. */
  options: CatalogItem[];
  cornerMode: boolean;
  canEditCosts: boolean;
  onChange: (patch: Partial<QuoteLine>) => void;
  onSwap: (item: CatalogItem) => void;
  onRemove: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const [editingPrice, setEditingPrice] = React.useState(false);

  const free = line.category === "libre";
  const med = line.mode === "med" && line.unit !== "unidad";
  const unit = UNIT_LABEL[line.unit];
  const catalogItem = options.find((o) => o.id === line.itemId);
  const adjusted = !free && line.priceOverridden;

  const byFinish = FINISHES.map((f) => ({ finish: f, items: options.filter((o) => o.finish === f) })).filter((g) => g.items.length > 0);
  const finishLabel = (f: Finish | null) => (f ? tt(`finish_${f}`) : "");
  const optionEl = (o: CatalogItem) => (
    <option key={o.id} value={o.id}>
      {o.name}
    </option>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-card px-2 pt-1.5 pb-2">
      <div className="flex basis-full items-center gap-2 text-[11px] tracking-[0.03em] text-muted-foreground">
        <span>{tt(`cat_${line.category}`)}</span>
        {cornerMode && ON_WALL.includes(line.shape) && (
          <button
            type="button"
            title={tt("line_wall_toggle")}
            onClick={() => onChange({ wall: line.wall === "B" ? "A" : "B", posX: null, posY: null })}
            className="px-1 hover:bg-muted/60 hover:text-foreground"
          >
            {tt("line_wall")} {line.wall === "B" ? "B" : "A"}
          </button>
        )}
        <span className="flex-1" />
        {gola && !(line.golaMl > 0) && (
          <button
            type="button"
            title={tt("line_gola_hint")}
            onClick={() => onChange({ golaMl: Math.max(0.01, Math.round((line.mode === "med" ? line.width * (line.pieces || 1) : 1) * 100) / 100), golaPrice: gola.price })}
            className="rounded px-1 font-medium text-foreground/70 hover:bg-muted/60 hover:text-foreground"
          >
            + {tt("line_gola")}
          </button>
        )}
        {line.unit !== "unidad" && (
          <button
            type="button"
            title={tt("line_mode_toggle")}
            onClick={() => onChange(med ? { mode: "dir", qty: lineQty(line) } : { mode: "med", width: line.width || 1, height: line.height || 1, pieces: line.pieces || 1 })}
            className="inline-flex items-center gap-1 px-1 hover:bg-muted/60 hover:text-foreground"
          >
            {med ? tt("line_mode_med") : tt("line_mode_dir")}
            <ArrowLeftRight className="size-3" />
          </button>
        )}
        <ConfirmButton iconOnly icon={X} label={tt("line_remove")} confirmLabel={tt("line_remove_confirm")} onConfirm={onRemove} className="p-0.5 hover:bg-muted/60" />
      </div>

      {free ? (
        <div className="flex min-w-0 flex-[1_1_150px] gap-1.5">
          <input
            value={line.name}
            onChange={(e) => onChange({ name: e.currentTarget.value })}
            placeholder={tt("line_free_ph")}
            aria-label={tt("line_free_ph")}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-[13px] outline-none focus-visible:border-ring"
          />
          <select
            value={line.unit}
            aria-label={tt("line_unit")}
            onChange={(e) => onChange({ unit: e.currentTarget.value as Unit, mode: "dir" })}
            className="h-7 rounded-md border border-input bg-card px-1 text-[13px] outline-none focus-visible:border-ring"
          >
            {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <select
          value={catalogItem ? catalogItem.id : ""}
          aria-label={tt(`cat_${line.category}`)}
          onChange={(e) => {
            const next = options.find((o) => o.id === e.currentTarget.value);
            if (next) onSwap(next);
          }}
          className="h-7 min-w-0 flex-[1_1_150px] rounded-md border border-input bg-card px-1.5 text-[13px] outline-none focus-visible:border-ring"
        >
          {!catalogItem && <option value="">{line.name}</option>}
          {byFinish.length > 1
            ? byFinish.map((g) => (
                <optgroup key={g.finish ?? "none"} label={finishLabel(g.finish)}>
                  {g.items.map(optionEl)}
                </optgroup>
              ))
            : options.map(optionEl)}
        </select>
      )}

      <div className="ml-auto flex flex-nowrap items-center gap-1.5">
        {med ? (
          <>
            <NumField value={line.width} onChange={(n) => onChange({ width: n })} suffix="m" inputWidth={40} aria-label={line.unit === "m2" ? tt("line_width") : tt("line_length")} title={line.unit === "m2" ? tt("line_width") : tt("line_length")} />
            {line.unit === "m2" && (
              <>
                <span className="text-[11px] text-muted-foreground">×</span>
                <NumField value={line.height} onChange={(n) => onChange({ height: n })} suffix="m" inputWidth={40} aria-label={tt("line_height")} title={tt("line_height")} />
              </>
            )}
            <span className="text-[11px] text-muted-foreground">×</span>
            <NumField value={line.pieces} onChange={(n) => onChange({ pieces: n })} suffix="pz" inputWidth={22} aria-label={tt("line_pieces")} title={tt("line_pieces")} />
            <span className="bg-cream-100 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-walnut tabular-nums">
              {lineQty(line).toLocaleString("en-US", { maximumFractionDigits: 2 })} {unit}
            </span>
          </>
        ) : (
          <NumField value={line.qty} onChange={(n) => onChange({ qty: n })} suffix={unit} inputWidth={52} aria-label={tt("line_qty")} title={tt("line_qty")} />
        )}

        {free || editingPrice ? (
          <span className="flex items-center gap-1.5">
            <NumField
              value={line.unitPrice}
              onChange={(n) => onChange({ unitPrice: n, priceOverridden: true })}
              prefix="$"
              inputWidth={58}
              autoFocus={editingPrice}
              aria-label={tt("line_price_this_quote")}
              title={tt("line_price_this_quote")}
            />
            {!free && catalogItem && adjusted && (
              <button type="button" onClick={() => onChange({ unitPrice: catalogItem.price, priceOverridden: false })} className="text-[11px] text-muted-foreground underline decoration-ink-900/16 hover:text-foreground">
                {tt("line_price_reset")}
              </button>
            )}
            {!free && canEditCosts && catalogItem && (
              <Link href={`/cotizacion/costos?item=${catalogItem.id}`} className="text-[11px] text-muted-foreground underline decoration-ink-900/16 hover:text-foreground">
                {tt("line_price_catalog")}
              </Link>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-0.5">
            <span
              title={adjusted && catalogItem ? `${tt("line_price_adjusted")} ${formatMoney(catalogItem.price)}` : tt("line_price_from_catalog")}
              className={cn("text-[11px] whitespace-nowrap tabular-nums", adjusted ? "font-semibold text-walnut" : "text-muted-foreground")}
            >
              × {formatMoney(line.unitPrice)}
            </span>
            <button type="button" aria-label={tt("line_price_edit")} title={tt("line_price_edit")} onClick={() => setEditingPrice(true)} className="p-0.5 text-ink-900/20 hover:text-ink-700">
              <Pencil className="size-3" />
            </button>
          </span>
        )}

        <span className="min-w-[78px] text-right text-sm font-semibold whitespace-nowrap tabular-nums">{formatMoney(lineAmount(line))}</span>
      </div>

      {line.golaMl > 0 && (
        // Anexo de la puerta o gaveta, en chico: su metraje y su precio. El
        // importe de la derecha del renglón ya incluye la gola.
        <div className="ml-auto flex basis-full flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted/70 px-1.5 py-0.5 font-medium text-foreground/70">{tt("line_gola")}</span>
          <NumField
            value={line.golaMl}
            onChange={(n) => onChange({ golaMl: n })}
            suffix="ML"
            inputWidth={34}
            className="h-6"
            aria-label={tt("line_gola_ml")}
            title={tt("line_gola_ml")}
          />
          <span className="tabular-nums">× {formatMoney(line.golaPrice)}</span>
          <span className="tabular-nums">= {formatMoney(golaAmount(line))}</span>
          <span className="text-muted-foreground/70">· {tt("line_gola_included")}</span>
          <button type="button" aria-label={tt("line_gola_remove")} title={tt("line_gola_remove")} onClick={() => onChange({ golaMl: 0 })} className="p-0.5 hover:text-destructive">
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
