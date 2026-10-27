"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { initialStockLines } from "@/lib/almacen/initial-stock";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { formatQty } from "@/lib/almacen/inventory";
import { registerAdjustmentAction } from "../actions";

const StockContext = React.createContext<{
  values: Record<string, string>;
  set: (id: string, value: string) => void;
  busy: boolean;
  enabled: boolean;
} | null>(null);

export function InitialStock({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const submitting = React.useRef(false);
  const router = useRouter();
  const entries = Object.entries(values).filter(([, value]) => value.trim() !== "");

  async function save() {
    if (submitting.current || !enabled || !entries.length) return;
    let lines;
    try {
      lines = initialStockLines(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revisa las cantidades.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await registerAdjustmentAction("inicial", "Carga inicial desde revisión del catálogo", true, lines);
      if (!result.ok) return toast.error(result.error);
      setValues({});
      router.refresh();
      toast.success(`Carga inicial guardada: ${lines.length} variantes.`);
    } catch {
      toast.error("No se pudo confirmar el guardado. Revisa el inventario antes de volver a intentarlo.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <StockContext.Provider value={{ values, set: (id, value) => setValues((prev) => ({ ...prev, [id]: value })), busy, enabled }}>
      <section className="sm:sticky top-0 z-20 rounded-lg border border-border bg-background p-4 shadow-sm">
        <h2 className="font-semibold">Carga inicial del inventario</h2>
        <p className="text-sm text-muted-foreground">
          Escribe la cantidad total que hay de cada variante en Existencia inicial, en la unidad indicada.
          Al guardar, esa cantidad reemplaza la existencia actual; no se suma. Vacío deja el inventario sin cambios y 0 lo deja en cero.
          Después, las entradas y salidas registradas actualizarán las existencias automáticamente.
        </p>
        {enabled ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm" role="status">{entries.length} variantes por guardar. Los mínimos y las notas se guardan por separado.</span>
            <ConfirmButton icon={Save} label={busy ? "Guardando…" : "Guardar carga inicial"} confirmLabel={`Confirmar ${entries.length} variantes`} disabled={busy || entries.length === 0} onConfirm={() => void save()} />
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">Necesitas el permiso de Ajustes de inventario para guardar la carga inicial.</p>}
      </section>
      {children}
    </StockContext.Provider>
  );
}

export function InitialStockInput({ id, name, stock }: { id: string; name: string; stock: number }) {
  const context = React.useContext(StockContext);
  if (!context) return null;
  return (
    <td className="py-1 pr-3 text-right">
      <input aria-label={`Existencia inicial ${name}`} inputMode="decimal" placeholder="Sin cambio"
        value={context.values[id] ?? ""} onChange={(e) => context.set(id, e.target.value)} disabled={!context.enabled || context.busy}
        className="h-8 w-28 rounded-md border border-input bg-background px-2 text-right tabular-nums disabled:opacity-50" />
      <span className="block text-xs text-muted-foreground">Actual: {formatQty(stock)}</span>
    </td>
  );
}
