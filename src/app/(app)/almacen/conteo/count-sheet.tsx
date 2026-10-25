"use client";

import * as React from "react";
import { Printer } from "lucide-react";

import type { InventoryCategory, InventoryItem } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_CLASS, ShowToggle } from "@/components/shared/page-header";
import { formatQty, unitLabel } from "@/lib/almacen/inventory";
import { ItemThumb, PageHeader, useTa } from "../shared";

const NONE = "none";

/**
 * Hoja de conteo para imprimir: cada producto con su foto y una línea por
 * variante, con la casilla vacía para escribir lo contado y otra para notas.
 * Agrupada por categoría (se puede imprimir una sola, estante por estante).
 * "Lo que dice el sistema" va apagado por defecto, para no influir el conteo.
 */
export function CountSheet({ items, categories }: { items: InventoryItem[]; categories: InventoryCategory[] }) {
  const { ta, lang } = useTa();
  const [category, setCategory] = React.useState("all");
  const [showSystem, setShowSystem] = React.useState(false);

  const groups = React.useMemo(() => {
    const active = items.filter((i) => i.active && i.variants.some((v) => v.active));
    const cats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    return [...cats.map((c) => ({ id: c.id, name: c.name })), { id: NONE, name: ta("no_category") }]
      .filter((c) => category === "all" || c.id === category)
      .map((c) => ({
        ...c,
        items: active
          .filter((i) => (i.categoryId ?? NONE) === c.id)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      }))
      .filter((g) => g.items.length > 0);
  }, [items, categories, category, ta]);

  const rows = groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.variants.filter((v) => v.active).length, 0), 0);
  const today = new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { day: "numeric", month: "long", year: "numeric" });
  const cell = "border border-neutral-300 px-2 py-1.5 align-middle";

  return (
    <div className={`${PAGE_CLASS} print:gap-3 print:p-0`}>
      {/* Pantalla: volver, elegir qué imprimir e imprimir. */}
      <div className="flex flex-col gap-4 print:hidden">
        <PageHeader
          back={{ href: "/almacen", label: ta("stock_title") }}
          title={ta("count_title")}
          subtitle={ta("count_subtitle")}
          action={
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              {ta("count_print")}
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ta("all_categories")}</SelectItem>
              {[...categories]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <ShowToggle checked={showSystem} onChange={setShowSystem} label={ta("count_show_system")} />
          <span className="text-xs text-muted-foreground">
            {rows} {ta("count_lines")}
          </span>
        </div>
      </div>

      {/* La hoja (en pantalla, como vista previa; al imprimir, sola). */}
      <article className="rounded-lg border border-border bg-white p-4 text-black sm:p-6 print:rounded-none print:border-0 print:p-0">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-black pb-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Ebony Custom Woodwork</p>
            <h1 className="text-lg font-bold">{ta("count_sheet_title")}</h1>
            <p className="text-xs text-neutral-600">
              {ta("count_printed")} {today}
            </p>
          </div>
          <div className="grid grid-cols-[auto_10rem] gap-x-2 gap-y-2 text-xs">
            <span>{ta("count_date")}</span>
            <span className="border-b border-black" />
            <span>{ta("count_by")}</span>
            <span className="border-b border-black" />
            <span>{ta("count_checked")}</span>
            <span className="border-b border-black" />
          </div>
        </header>

        {groups.map((g) => (
          <section key={g.id} className="mb-5 break-inside-avoid-page">
            <h2 className="mb-1.5 text-sm font-bold uppercase break-after-avoid">{g.name}</h2>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="bg-neutral-100 text-left">
                  <th className={`${cell} w-[60px]`}>{ta("count_col_photo")}</th>
                  <th className={`${cell} w-[26%]`}>{ta("col_product")}</th>
                  <th className={`${cell} w-[18%]`}>{ta("count_col_variant")}</th>
                  <th className={`${cell} w-[70px]`}>{ta("count_col_unit")}</th>
                  {showSystem && <th className={`${cell} w-[70px] text-right`}>{ta("count_col_system")}</th>}
                  <th className={`${cell} w-[90px] text-center`}>{ta("count_col_counted")}</th>
                  <th className={cell}>{ta("notes")}</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((item) => {
                  const variants = item.variants.filter((v) => v.active).sort((a, b) => a.sortOrder - b.sortOrder);
                  return variants.map((v, i) => (
                    <tr key={v.id} className="break-inside-avoid">
                      {i === 0 && (
                        <td className={`${cell} text-center`} rowSpan={variants.length}>
                          <ItemThumb path={item.photoPath} size={48} eager className="mx-auto rounded-sm" />
                        </td>
                      )}
                      {i === 0 && (
                        <td className={`${cell} font-semibold`} rowSpan={variants.length}>
                          {item.name}
                        </td>
                      )}
                      <td className={cell}>{v.label || "—"}</td>
                      <td className={cell}>{unitLabel(item.unit, 2, lang)}</td>
                      {showSystem && <td className={`${cell} text-right tabular-nums`}>{formatQty(v.stockQty, lang)}</td>}
                      <td className={`${cell} h-10`} />
                      <td className={cell} />
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </section>
        ))}

        <p className="mt-2 text-[11px] text-neutral-600">{ta("count_footer")}</p>
      </article>
    </div>
  );
}
