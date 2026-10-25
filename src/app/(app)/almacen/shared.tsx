"use client";

import * as React from "react";
import { ChevronDown, Package } from "lucide-react";

import type { InventoryItem, InventoryVariant } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { formatQty, stockStatus, unitLabel, variantName } from "@/lib/almacen/inventory";
import { inventoryPhotoUrl } from "@/lib/almacen/photos";

export type AlmacenKey = keyof typeof strings.almacen;

/** Textos del Almacén en el idioma actual, con {n} / {stock} reemplazados. */
export function useTa() {
  const { lang } = useLang();
  const ta = React.useCallback(
    (k: AlmacenKey, vars?: Record<string, string | number>) => {
      let s = t(lang, strings.almacen[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    [lang],
  );
  return { ta, lang };
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-ink-900/16 px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-8 w-full flex-[1_1_200px] border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 sm:max-w-xs"
    />
  );
}

export function StockBadge({ variant }: { variant: Pick<InventoryVariant, "stockQty" | "minQty"> }) {
  const { ta } = useTa();
  const s = stockStatus(variant);
  if (s === "sin") return <Badge variant="destructive">{ta("status_out")}</Badge>;
  if (s === "bajo") return <Badge variant="warning">{ta("status_low")}</Badge>;
  return <Badge variant="success">{ta("status_ok")}</Badge>;
}

/** Foto del producto (o un ícono si no tiene). `size="fill"` ocupa todo el espacio del contenedor. */
export function ItemThumb({ path, size = 40, className }: { path: string | null; size?: number | "fill"; className?: string }) {
  const url = inventoryPhotoUrl(path);
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-ink-900/8 bg-white ${className ?? ""}`}
      style={size === "fill" ? undefined : { width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto pública de Supabase Storage; next/image no aplica.
        <img src={url} alt="" loading="lazy" className="size-full object-contain" />
      ) : (
        <Package className="size-1/2 text-muted-foreground/40" />
      )}
    </span>
  );
}

export interface VariantRef {
  item: InventoryItem;
  variant: InventoryVariant;
  name: string;
}

/** variantId → producto, variante y nombre para mostrar. */
export function useVariantIndex(items: InventoryItem[]): Map<string, VariantRef> {
  return React.useMemo(() => {
    const map = new Map<string, VariantRef>();
    for (const item of items) for (const variant of item.variants) map.set(variant.id, { item, variant, name: variantName(item.name, variant.label) });
    return map;
  }, [items]);
}

/** "12 metros" con la unidad del producto. */
export function qtyWithUnit(qty: number, unit: string | null | undefined, lang: "es" | "en"): string {
  return `${formatQty(qty, lang)} ${unitLabel(unit, qty, lang)}`;
}

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  group?: string;
}

/** Lista desplegable con búsqueda (personas, proyectos, proveedores, productos). */
export function Combo({
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const { ta } = useTa();
  const [open, setOpen] = React.useState(false);
  const picked = options.find((o) => o.value === value);
  const groups = React.useMemo(() => {
    const map = new Map<string, ComboOption[]>();
    for (const o of options) map.set(o.group ?? "", [...(map.get(o.group ?? "") ?? []), o]);
    return [...map.entries()];
  }, [options]);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-between font-normal ${className ?? ""}`}>
          <span className={`truncate ${picked ? "" : "text-muted-foreground"}`}>{picked ? picked.label : placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={ta("search_ph")} />
          <CommandList>
            <CommandEmpty>{ta("no_results")}</CommandEmpty>
            {groups.map(([group, opts]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {opts.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.hint ?? ""} ${o.value}`}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.hint && <span className="truncate text-xs text-muted-foreground">{o.hint}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Opciones de productos activos (una por variante), con la existencia de pista. */
export function useVariantOptions(items: InventoryItem[], categoryName: (id: string | null) => string): ComboOption[] {
  const { ta, lang } = useTa();
  return React.useMemo(
    () =>
      items
        .filter((i) => i.active)
        .flatMap((i) =>
          i.variants
            .filter((v) => v.active)
            .map((v) => ({
              value: v.id,
              label: variantName(i.name, v.label),
              hint: `${ta("stock_now")}: ${qtyWithUnit(v.stockQty, i.unit, lang)}`,
              group: categoryName(i.categoryId),
            })),
        ),
    [items, categoryName, ta, lang],
  );
}

/** Campo de cantidad: acepta "12,5" o "12.5". */
export function QtyInput({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      className={`h-9 w-full rounded-md border border-input bg-card px-2.5 text-right text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 ${className ?? ""}`}
      {...rest}
    />
  );
}
