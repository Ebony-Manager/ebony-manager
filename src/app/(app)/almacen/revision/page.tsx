import { AlertTriangle } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { formatQty, unitLabel } from "@/lib/almacen/inventory";
import { EXCEL_DELETED, EXCEL_ONLY, ITEM_PROPOSALS, PROPOSED_SUPPLIERS, type ItemProposal } from "@/lib/almacen/supplier-proposal";
import { getCatalog, getCategories } from "@/services/almacen";
import type { InventoryItem } from "@/types/almacen";
import { ItemThumb } from "../shared";

// Almacén → Revisión (temporal, solo admin): el catálogo como está en la app
// (foto, variantes, mínimo y "pedir hasta") con los proveedores propuestos a
// partir del Excel. Solo lectura: se usa para revisar antes de cargarlo.
export const dynamic = "force-dynamic";

const SUPPLIER = new Map(PROPOSED_SUPPLIERS.map((s) => [s.key, s]));
const supplierName = (key: string) => SUPPLIER.get(key)?.name ?? key;

export default async function RevisionPage() {
  await requireAdmin();
  const [items, categories] = await Promise.all([getCatalog(), getCategories()]);
  const active = items.filter((i) => i.active);
  const doubts = active.filter((i) => ITEM_PROPOSALS[i.name]?.doubt);
  const noSupplier = active.filter((i) => !ITEM_PROPOSALS[i.name]);
  const variantCount = active.reduce((n, i) => n + i.variants.filter((v) => v.active).length, 0);
  const withMin = active.reduce((n, i) => n + i.variants.filter((v) => v.active && v.minQty != null).length, 0);
  const productsBySupplier = new Map<string, number>();
  for (const i of active) {
    const p = ITEM_PROPOSALS[i.name];
    if (p) productsBySupplier.set(p.primary, (productsBySupplier.get(p.primary) ?? 0) + 1);
  }
  const uniqueDoubts = [...new Set(doubts.map((i) => ITEM_PROPOSALS[i.name].doubt!))];

  return (
    <div className="flex flex-col gap-8 px-4 pt-6 pb-16 sm:px-7">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Almacén · Revisión antes de oficializar</p>
        <h1 className="text-2xl font-semibold text-foreground">Catálogo y proveedores</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Así está hoy cada producto en la app, con los proveedores que salen del Excel &quot;Inventario General&quot;. Nada de esto se guarda todavía: los
          proveedores se cargan cuando lo apruebes. &quot;Pedir hasta&quot; es la cantidad a la que se repone cuando baja del mínimo.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Productos" value={active.length} />
          <Stat label="Variantes" value={variantCount} hint={`${withMin} con mínimo`} />
          <Stat label="Proveedores" value={PROPOSED_SUPPLIERS.length} />
          <Stat label="Por confirmar" value={uniqueDoubts.length + (noSupplier.length ? 1 : 0)} hint={`${noSupplier.length} sin proveedor`} warn />
        </dl>
      </header>

      <section className="flex flex-col gap-3 border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <AlertTriangle className="size-4 text-amber-600" />
          Preguntas antes de cargar
        </h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-foreground">
          {uniqueDoubts.map((d) => (
            <li key={d}>{d}</li>
          ))}
          {noSupplier.length > 0 && (
            <li>
              Sin proveedor en el Excel ({noSupplier.length}): {noSupplier.map((i) => i.name).join(", ")}. ¿A quién se le compran?
            </li>
          )}
          <li>
            En el Excel pero no en el almacén: {EXCEL_ONLY.map((e) => `${e.name} (${supplierName(e.supplier)}${e.note ? `; ${e.note}` : ""})`).join(", ")}. ¿Se
            agrega alguno como producto?
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">También salen en el Excel, pero ya se eliminaron de la app: {EXCEL_DELETED.join(", ")}.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Proveedores</h2>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="px-3 py-2 font-medium">Contacto</th>
                <th className="px-3 py-2 font-medium">Teléfono / WhatsApp</th>
                <th className="px-3 py-2 text-right font-medium">Productos (principal)</th>
                <th className="px-3 py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {PROPOSED_SUPPLIERS.map((s) => (
                <tr key={s.key} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.contact ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{s.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{productsBySupplier.get(s.key) ?? 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {categories.map((c) => {
        const list = active.filter((i) => i.categoryId === c.id);
        if (list.length === 0) return null;
        return (
          <section key={c.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {c.name} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
            </h2>
            <ul className="flex flex-col divide-y divide-border border border-border">
              {list.map((item) => (
                <ProductRow key={item.id} item={item} proposal={ITEM_PROPOSALS[item.name]} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col border border-border bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-xl font-semibold tabular-nums ${warn ? "text-amber-600" : "text-foreground"}`}>{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function ProductRow({ item, proposal }: { item: InventoryItem; proposal: ItemProposal | undefined }) {
  const variants = item.variants.filter((v) => v.active);
  const unit = unitLabel(item.unit, 2);
  return (
    <li className="grid gap-4 p-3 sm:p-4 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,1.1fr)]">
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
        {proposal ? (
          <div className="flex flex-col gap-1 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Principal: </span>
              <span className="font-medium">{supplierName(proposal.primary)}</span>
            </div>
            {proposal.alternatives?.length ? (
              <div>
                <span className="text-xs text-muted-foreground">Alternativo: </span>
                {proposal.alternatives.map(supplierName).join(", ")}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">En el Excel: {proposal.excel}</div>
            {proposal.doubt && (
              <div className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {proposal.doubt}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Sin proveedor en el Excel
          </div>
        )}
      </div>
      <div className="min-w-0 overflow-x-auto">
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
                <td className="py-1 pr-3 text-right tabular-nums">{v.minQty != null ? formatQty(v.minQty) : "—"}</td>
                <td className="py-1 text-right tabular-nums">{v.reorderQty != null ? formatQty(v.reorderQty) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </li>
  );
}
