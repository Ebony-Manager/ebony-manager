"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { InventoryItem, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { assignItemSupplierAction } from "../actions";
import { Combo } from "../shared";

export function RevisionSuppliers({ item, suppliers, canEdit }: { item: InventoryItem; suppliers: Supplier[]; canEdit: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const saving = React.useRef(false);
  const names = new Map(suppliers.map((s) => [s.id, s.name]));
  const primary = item.suppliers.find((s) => s.isPrimary);
  const alternatives = item.suppliers.filter((s) => !s.isPrimary);
  const options = suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.contactName ?? undefined }));

  async function assign(asPrimary: boolean) {
    if (!selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const result = await assignItemSupplierAction(item.id, selected, asPrimary);
      if (!result.ok) return toast.error(result.error);
      setSelected(null);
      router.refresh();
      toast.success(`${item.name}: proveedor guardado`);
    } catch {
      toast.error("No se pudo confirmar el guardado del proveedor. Recarga para comprobarlo.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm">
      <p><span className="text-muted-foreground">Principal guardado: </span>{primary ? (names.get(primary.supplierId) ?? "Proveedor no disponible") : "Sin asignar"}</p>
      {alternatives.length > 0 && <p><span className="text-muted-foreground">Alternativos: </span>{alternatives.map((s) => names.get(s.supplierId) ?? "Proveedor no disponible").join(", ")}</p>}
      {canEdit && (
        <>
          <fieldset disabled={busy} className="min-w-0">
            <legend className="sr-only">Proveedor de {item.name}</legend>
            <Combo options={options} value={selected} onChange={setSelected} placeholder="Buscar proveedor del directorio" />
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !selected} onClick={() => void assign(true)}>Guardar principal</Button>
            <Button size="sm" variant="outline" disabled={busy || !selected || item.suppliers.some((s) => s.supplierId === selected)} onClick={() => void assign(false)}>Agregar alternativo</Button>
          </div>
          <p className="text-xs text-muted-foreground">Al cambiar el principal, el anterior queda como alternativo.</p>
        </>
      )}
    </div>
  );
}
