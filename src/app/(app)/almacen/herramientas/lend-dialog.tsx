"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { InventoryPerson, Tool } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { toolName } from "@/lib/almacen/tools";
import { Field } from "../../contratistas/field";
import { lendToolsAction } from "../actions";
import { Combo, ItemThumb, SearchBox, useTa } from "../shared";
import type { Project } from "./common";

/**
 * Prestar: a quién (de Personal), una o varias herramientas disponibles,
 * proyecto y fecha de devolución opcionales (sin fecha, vence a los 7 días).
 * `preselected`: null = cerrado; [] = sin elegir; [id] = desde una fila.
 */
export function LendDialog({
  preselected,
  tools,
  people,
  projects,
  onClose,
}: {
  preselected: string[] | null;
  tools: Tool[];
  people: InventoryPerson[];
  projects: Project[];
  onClose: () => void;
}) {
  const { ta } = useTa();
  const open = preselected !== null;
  const [recipient, setRecipient] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [dueOn, setDueOn] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setRecipient(null);
    setPicked(new Set(preselected));
    setQuery("");
    setProjectId(null);
    setDueOn("");
    setNotes("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const personOptions = React.useMemo(
    () => people.filter((p) => p.active).map((p) => ({ value: `${p.kind}:${p.id}`, label: p.name, group: ta(p.kind === "empleado" ? "employee" : "contractor") })),
    [people, ta],
  );
  const projectOptions = React.useMemo(() => projects.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name })), [projects]);
  const available = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return tools
      .filter((t) => t.active && t.status === "disponible")
      .filter((t) => picked.has(t.id) || !q || matchesSearch(`${toolName(t)} ${t.brand ?? ""}`, q))
      .sort((a, b) => a.name.localeCompare(b.name, "es") || (a.number ?? 0) - (b.number ?? 0));
  }, [tools, query, picked]);

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function submit() {
    setError(null);
    if (!recipient) return setError(ta("recipient_required"));
    if (picked.size === 0) return setError(ta("lend_tools_required"));
    const [kind, id] = recipient.split(":") as ["empleado" | "contratista", string];
    setSaving(true);
    const res = await lendToolsAction({ toolIds: [...picked], recipient: { kind, id }, projectId, dueOn: dueOn || null, notes });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("lend_saved"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("lend_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={ta("lend_to")}>
            <Combo options={personOptions} value={recipient} onChange={setRecipient} placeholder={ta("pick_person")} />
          </Field>

          <Field label={`${ta("lend_pick_tools")}${picked.size ? ` · ${ta("lend_selected", { n: picked.size })}` : ""}`}>
            {/* Envuelto: SearchBox crece a lo ancho en las barras de filtros; acá va en columna. */}
            <div>
              <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
            </div>
            {available.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                {query ? ta("no_results") : ta("lend_none_available")}
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-border">
                {available.map((t) => (
                  <li key={t.id} className="border-b border-border last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
                      <input type="checkbox" className="size-4 accent-primary" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                      <ItemThumb path={t.photoPath} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{toolName(t)}</span>
                        {t.brand && <span className="block truncate text-xs text-muted-foreground">{t.brand}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ta("dest_project")}>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Combo options={projectOptions} value={projectId} onChange={setProjectId} placeholder={ta("optional")} />
                {projectId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId(null)}>
                    {ta("remove")}
                  </Button>
                )}
              </div>
            </Field>
            <Field label={ta("lend_due")} hint={ta("lend_due_hint")}>
              <Input type="date" min={todayInPanama()} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </Field>
          </div>

          <Field label={ta("notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ta("optional")} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {ta("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? ta("saving") : picked.size > 1 ? ta("lend_n", { n: picked.size }) : ta("lend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
