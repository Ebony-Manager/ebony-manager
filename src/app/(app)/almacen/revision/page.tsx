import { AlertTriangle } from "lucide-react";

import { hasModule } from "@/lib/auth/modules";
import { InitialStock } from "./initial-stock";
import { requireModule } from "@/lib/auth/dal";
import { formatQty, unitLabel } from "@/lib/almacen/inventory";
import { EXCEL_DELETED, ITEM_PROPOSALS, NEW_PRODUCTS, PROPOSED_SUPPLIERS, type ItemProposal } from "@/lib/almacen/supplier-proposal";
import { getCatalog, getCategories, getSuppliers } from "@/services/almacen";
import type { InventoryItem } from "@/types/almacen";
import { RevisionRow, type SupplierLine } from "./revision-row";

// Almacén → Revisión (temporal; Almacén + Compras): el catálogo como está en
// la app (foto, variantes, mínimo y "pedir hasta") con los proveedores
// propuestos a partir del Excel. Los mínimos y la nota de cada producto se
// editan y guardan aquí, junto con los proveedores y la carga inicial.
export const dynamic = "force-dynamic";

const SUPPLIER = new Map(PROPOSED_SUPPLIERS.map((s) => [s.key, s]));
const supplierName = (key: string) => SUPPLIER.get(key)?.name ?? key;

function supplierLine(p: ItemProposal | undefined): SupplierLine {
  return {
    primary: p?.primary ? supplierName(p.primary) : null,
    alternatives: (p?.alternatives ?? []).map(supplierName),
    excel: p && p.excel !== "—" ? p.excel : null,
    note: p?.note ?? null,
    doubt: p?.doubt ?? null,
  };
}

export default async function RevisionPage() {
  const profile = await requireModule("almacen", "almacen_compras");
  const [items, categories, suppliers] = await Promise.all([getCatalog(), getCategories(), getSuppliers()]);
  const active = items.filter((i) => i.active);
  const doubts = active.filter((i) => ITEM_PROPOSALS[i.name]?.doubt);
  const noSupplier = active.filter((i) => !i.suppliers.some((s) => s.isPrimary));
  const variantCount = active.reduce((n, i) => n + i.variants.filter((v) => v.active).length, 0);
  const withMin = active.reduce((n, i) => n + i.variants.filter((v) => v.active && v.minQty != null).length, 0);
  const productsBySupplier = new Map<string, number>();
  for (const i of active) {
    const p = ITEM_PROPOSALS[i.name];
    if (p?.primary) productsBySupplier.set(p.primary, (productsBySupplier.get(p.primary) ?? 0) + 1);
  }
  for (const n of NEW_PRODUCTS.filter((x) => x.primary)) productsBySupplier.set(n.primary, (productsBySupplier.get(n.primary) ?? 0) + 1);
  const questions = [
    ...doubts.map((i) => `${i.name}: ${ITEM_PROPOSALS[i.name].doubt}`),
    ...NEW_PRODUCTS.filter((n) => n.doubt).map((n) => `${n.name} (nuevo): ${n.doubt}`),
  ];

  // Para afinar: lo que el cálculo por consumo (JotForm de egresos) dejó raro o vacío.
  const live = (i: InventoryItem) => i.variants.filter((v) => v.active);
  const withoutMin = active.filter((i) => live(i).every((v) => v.minQty == null));
  const partialMin = active.filter((i) => {
    const vs = live(i);
    return vs.length > 1 && vs.some((v) => v.minQty != null) && vs.some((v) => v.minQty == null);
  });
  const bulk = active.flatMap((i) =>
    live(i)
      .filter((v) => (v.minQty ?? 0) >= 50)
      .map((v) => `${i.name}${v.label ? ` ${v.label}` : ""}: mínimo ${formatQty(v.minQty!)} ${unitLabel(i.unit, v.minQty!)}`),
  );
  const returnable = active.filter((i) => i.kind === "devolvible" && live(i).some((v) => v.minQty != null));

  return (
    <div className="flex flex-col gap-8 px-4 pt-6 pb-16 sm:px-7">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Almacén · Revisión antes de oficializar</p>
        <h1 className="text-xl font-semibold text-foreground">Catálogo y proveedores</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Así está hoy cada producto en la app, con los proveedores que salen del Excel &quot;Inventario General&quot;. En cada producto puedes corregir el
          mínimo y el &quot;pedir hasta&quot; de cada variante y dejar una nota. También puedes asignar proveedores del directorio y cargar las existencias iniciales desde aquí. Cada sección tiene su botón para guardar. Las propuestas del Excel son solo referencia. El mínimo es lo que debe haber siempre; cuando baja de ahí, la app pide comprar hasta llegar a &quot;pedir hasta&quot;. Si dejas &quot;pedir
          hasta&quot; vacío, se llena solo con el doble del mínimo.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Productos" value={active.length} hint={`+${NEW_PRODUCTS.length} nuevos`} />
          <Stat label="Variantes" value={variantCount} hint={`${withMin} con mínimo`} />
          <Stat label="Proveedores del directorio" value={suppliers.filter((s) => s.active).length} />
          <Stat label="Por confirmar" value={questions.length} hint={`${noSupplier.length} sin proveedor`} warn />
        </dl>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <AlertTriangle className="size-4 text-amber-600" />
          Preguntas antes de cargar
        </h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-foreground">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">También salen en el Excel, pero ya se eliminaron de la app: {EXCEL_DELETED.join(", ")}.</p>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Para afinar los mínimos</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Los mínimos salen del consumo registrado en el JotForm de egresos: 2 semanas de consumo, y &quot;pedir hasta&quot; es el doble. Lo que casi no se
            registraba quedó sin mínimo, y por eso la app nunca va a avisar que se está acabando.
          </p>
        </div>
        <Finding title={`Sin ningún mínimo (${withoutMin.length})`} hint="¿Cuáles de estos no pueden faltar? Dime cuánto tener como mínimo.">
          {withoutMin.map((i) => i.name).join(", ")}
        </Finding>
        <Finding
          title={`Con mínimo solo en algunas variantes (${partialMin.length})`}
          hint="Las variantes sin mínimo (con — en la tabla de cada producto) no avisan. ¿Se dejan así o se les pone el mismo de su hermana?"
        >
          {partialMin.map((i) => i.name).join(", ")}
        </Finding>
        <Finding
          title={`Cantidades grandes (${bulk.length})`}
          hint="Estos se compran por caja, rollo o bolsa. Si me dices cuánto trae cada presentación, el pedido por WhatsApp sale en cajas o rollos y no en unidades sueltas."
        >
          <ul className="flex flex-col gap-0.5">
            {bulk.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Finding>
        <Finding
          title={`Se prestan y se devuelven, pero tienen mínimo (${returnable.length})`}
          hint="Su consumo real es menor que lo que salió en el JotForm, porque vuelven. ¿Se bajan los mínimos o se tratan como consumibles?"
        >
          {returnable.map((i) => i.name).join(", ")}
        </Finding>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Proveedores propuestos en el Excel</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="px-3 py-2 font-medium">Contacto</th>
                <th className="px-3 py-2 font-medium">Teléfono / correo</th>
                <th className="px-3 py-2 text-right font-medium">Productos (principal)</th>
                <th className="px-3 py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {PROPOSED_SUPPLIERS.map((s) => (
                <tr key={s.key} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.contact ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{productsBySupplier.get(s.key) ?? 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Productos nuevos{" "}
          <span className="text-sm font-normal text-muted-foreground">({NEW_PRODUCTS.length}, se agregan al aprobar; luego les ponemos foto y mínimo)</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Unidad</th>
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Alternativo</th>
                <th className="px-3 py-2 font-medium">Por confirmar</th>
              </tr>
            </thead>
            <tbody>
              {NEW_PRODUCTS.map((n) => (
                <tr key={n.name} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {n.name}
                    {n.variants?.length ? <span className="block text-xs font-normal text-muted-foreground">{n.variants.join(", ")}</span> : null}
                    {n.note ? <span className="block text-xs font-normal text-muted-foreground">{n.note}</span> : null}
                  </td>
                  <td className="px-3 py-2">{n.category}</td>
                  <td className="px-3 py-2">{unitLabel(n.unit, 1)}</td>
                  <td className="px-3 py-2">{n.primary ? supplierName(n.primary) : "—"}</td>
                  <td className="px-3 py-2">{n.alternatives?.map(supplierName).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-amber-700 dark:text-amber-400">{n.doubt ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <InitialStock enabled={hasModule(profile, "almacen_ajustes")}>
        {categories.map((c) => {
          const list = active.filter((i) => i.categoryId === c.id);
          if (list.length === 0) return null;
          return (
            <section key={c.id} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {c.name} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
              </h2>
              <ul className="flex flex-col divide-y divide-border rounded-lg overflow-hidden border border-border">
                {list.map((item) => (
                  <RevisionRow key={item.id} item={item} directory={suppliers} suppliers={supplierLine(ITEM_PROPOSALS[item.name])} canEdit />
                ))}
              </ul>
            </section>
          );
        })}
      </InitialStock>
    </div>
  );
}

function Finding({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-xl font-semibold tabular-nums ${warn ? "text-amber-600" : "text-foreground"}`}>{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
