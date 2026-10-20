"use client";

import * as React from "react";
import { Pencil, Check, X, Plus } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollPosition } from "@/types/planilla";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getPayrollPositionsAction, createPayrollPositionAction, updatePayrollPositionAction } from "./actions";

/**
 * Administra el catálogo de posiciones (`payroll_positions`), abierto
 * desde el ícono de engranaje junto a "Posición" en `EmployeeFormDialog`.
 * Se auto-carga (`getPayrollPositionsAction`) cada vez que se abre, en
 * vez de depender de la prop `positions` que le llega al formulario desde
 * el servidor — mismo patrón de "cargar y `load()` de nuevo tras cada
 * cambio" que ya usa `LedgerSection`. Además de refrescar su propia
 * lista, avisa al padre vía `onPositionsChanged` para que el Select de
 * "Posición" (que sigue abierto detrás) muestre la novedad al toque, sin
 * esperar a que `router.refresh()` vuelva a bajar la prop del servidor.
 *
 * Desactivar es el único "borrado" — nunca delete real, así ningún
 * empleado histórico con esa posición queda roto.
 */
export function ManagePositionsDialog({
  open,
  onOpenChange,
  onPositionsChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPositionsChanged?: (positions: PayrollPosition[]) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [list, setList] = React.useState<PayrollPosition[] | null>(null);
  const [newName, setNewName] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const fresh = await getPayrollPositionsAction();
    setList(fresh);
    onPositionsChanged?.(fresh);
    // También sincroniza la prop que baja del servidor (payroll/page.tsx)
    // para todo lo demás que lea el catálogo, aparte de este diálogo.
    return fresh;
  }, [onPositionsChanged]);

  /* eslint-disable react-hooks/set-state-in-effect -- carga al abrir; el diálogo se reusa entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setEditingId(null);
    setNewName("");
    load();
  }, [open, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      await createPayrollPositionAction(name);
      setNewName("");
      await load();
      toast.success(tt("action_add"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(position: PayrollPosition) {
    setEditingId(position.id);
    setEditValue(position.name);
  }

  async function saveEdit(id: string) {
    const name = editValue.trim();
    if (!name) {
      setError(tt("position_name_required"));
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      await updatePayrollPositionAction(id, { name });
      setEditingId(null);
      await load();
      toast.success(tt("action_save"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(position: PayrollPosition) {
    setSavingId(position.id);
    setError(null);
    try {
      await updatePayrollPositionAction(position.id, { active: !position.active });
      await load();
      toast.success(tt(position.active ? "position_inactive" : "position_active"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tt("dlg_positions_title")}</DialogTitle>
          <DialogDescription>{tt("dlg_positions_desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {list === null && <p className="py-4 text-center text-sm text-muted-foreground">{tt("loading")}</p>}

          {list !== null && list.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{tt("position_empty")}</p>
          )}

          {list?.map((position) => {
            const isEditing = editingId === position.id;
            const isSaving = savingId === position.id;
            return (
              <div
                key={position.id}
                className={`flex items-center gap-2 border border-border px-2.5 py-2 text-sm ${
                  position.active ? "" : "opacity-50"
                }`}
              >
                {isEditing ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      className="h-8"
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(position.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={isSaving}
                      onClick={() => saveEdit(position.id)}
                      aria-label={tt("action_save")}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={isSaving}
                      onClick={() => setEditingId(null)}
                      aria-label={tt("action_cancel")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 truncate ${position.active ? "text-foreground" : "line-through"}`}>
                      {position.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={isSaving}
                      onClick={() => startEdit(position)}
                      aria-label={tt("action_edit")}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={position.active}
                        disabled={isSaving}
                        onChange={() => toggleActive(position)}
                        className="size-4 rounded-lg border-input accent-primary"
                      />
                      {position.active ? tt("position_active") : tt("position_inactive")}
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tt("position_name_ph")}
            className="h-8"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" disabled={adding || !newName.trim()} onClick={handleAdd}>
            <Plus className="size-3.5" />
            {tt("action_add")}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tt("action_close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
