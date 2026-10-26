"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatQty, parseQty, unitLabel } from "@/lib/almacen/inventory";
import type { InventoryItem } from "@/types/almacen";
import { saveItemLevelsAction } from "../actions";
import { ItemThumb } from "../shared";

export interface SupplierLine {
  primary: string | null;
  alternatives: string[];
  excel: string | null;
  note: string | null;
  doubt: string | null;
}

const asText = (n: number | null) => (n == null ? "" : String(n));

/**
 * Un producto en la pantalla de revisión: foto, proveedores propuestos y, por
 * variante, mínimo y "pedir hasta" editables (quien tiene Compras), más una
 * nota. Al escribir un mínimo sin "pedir hasta", se propone el doble.
 */
export function RevisionRow({ item, suppliers, canEdit }: { item: InventoryItem; suppliers: SupplierLine; canEdit: boolean }) {
  const variants = React.useMemo(() => item.variants.filter((v) => v.active), [item.variants]);
  const initial = React.useMemo(() => Object.fromEntries(variants.map((v) => [v.id, { min: asText(v.minQty), reorder: asText(v.reorderQty) }])), [variants]);
  const [levels, setLevels] = React.useState(initial);
  const [notes, setNotes] = React.useState(item.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState({ levels: initial, notes: item.notes ?? "" });

  const dirty =
    notes !== saved.notes || variants.some((v) => levels[v.id].min !== saved.levels[v.id].min || levels[v.id].reorder !== saved.levels[v.id].reorder);
  const set = (id: string, key: "min" | "reorder", value: string) => setLevels((l) => ({ ...l, [id]: { ...l[id], [key]: value } }));

  function suggestReorder(id: string) {
    const min = parseQty(levels[id].min);
    if (min != null && !levels[id].reorder.trim()) set(id, "reorder", String(min * 2));
  }

  async function save() {
    const payload = [];
    for (const v of variants) {
      const { min, reorder } = levels[v.id];
      const minQty = parseQty(min);
      const reorderQty = parseQty(reorder);
      if ((min.trim() && minQty == null) || (reorder.trim() && reorderQty == null)) return toast.error(`Revisa los números de ${v.label || item.name}.`);
      if (minQty != null && reorderQty != null && reorderQty < minQty)
        return toast.error(`${v.label || item.name}: "pedir hasta" no puede ser menor que el mínimo.`);
      payload.push({ variantId: v.id, minQty, reorderQty });
    }
    setSaving(true);
    const res = await saveItemLevelsAction(item.id, payload, notes.trim() || null);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setSaved({ levels, notes });
    toast.success(`${item.name}: guardado`);
  }

  const unit = unitLabel(item.unit, 2);
  return (
    <li className={`grid gap-4 p-3 sm:p-4 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,1.2fr)] ${dirty ? "bg-amber-500/5" : ""}`}>
      <ItemThumb path={item.photoPath} size={96} />
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <div className="font-semibold text-foreground">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            En {unit}
            {item.kind === "devolvible" && " · se presta y se devuelve"}
            {!item.photoPath && " · sin foto"}
          </div>
        </div>
        {suppliers.primary ? (
          <div className="flex flex-col gap-1 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Principal: </span>
              <span className="font-medium">{suppliers.primary}</span>
            </div>
            {suppliers.alternatives.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Alternativo: </span>
                {suppliers.alternatives.join(", ")}
              </div>
            )}
            {suppliers.excel && <div className="text-xs text-muted-foreground">En el Excel: {suppliers.excel}</div>}
            {suppliers.note && <div className="text-xs text-muted-foreground">{suppliers.note}</div>}
            {suppliers.doubt && (
              <div className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {suppliers.doubt}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {suppliers.doubt ?? "Sin proveedor"}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Variante</th>
                <th className="py-1 pr-3 text-right font-medium">Mínimo</th>
                <th className="py-1 text-right font-medium">Pedir hasta</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-border/60">
                  <td className="py-1 pr-3">{v.label || "Única"}</td>
                  {canEdit ? (
                    <>
                      <td className="py-1 pr-3 text-right">
                        <input
                          id={`min-${v.id}`}
                          aria-label={`Mínimo ${v.label || item.name}`}
                          inputMode="decimal"
                          value={levels[v.id].min}
                          onChange={(e) => set(v.id, "min", e.target.value)}
                          onBlur={() => suggestReorder(v.id)}
                          placeholder="—"
                          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-1 text-right">
                        <input
                          id={`reorder-${v.id}`}
                          aria-label={`Pedir hasta ${v.label || item.name}`}
                          inputMode="decimal"
                          value={levels[v.id].reorder}
                          onChange={(e) => set(v.id, "reorder", e.target.value)}
                          placeholder="—"
                          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right tabular-nums"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1 pr-3 text-right tabular-nums">{v.minQty != null ? formatQty(v.minQty) : "—"}</td>
                      <td className="py-1 text-right tabular-nums">{v.reorderQty != null ? formatQty(v.reorderQty) : "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <>
            <textarea
              id={`notes-${item.id}`}
              aria-label={`Nota de ${item.name}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Nota: cómo viene (caja de 1,000, rollo de 50 m…), comentarios"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              {dirty && <span className="text-xs text-amber-700 dark:text-amber-400">Sin guardar</span>}
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </>
        ) : (
          item.notes && <p className="text-xs text-muted-foreground">Nota: {item.notes}</p>
        )}
      </div>
    </li>
  );
}
