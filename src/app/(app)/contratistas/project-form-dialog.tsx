"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import type { Project, ProjectStatus } from "@/types/contractors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createProjectAction, updateProjectAction } from "./actions";
import { Field } from "./field";

/**
 * Alta / edición de un proyecto de Ebony (ficha simple: nombre, cliente,
 * estado, notas). Se usa desde la pestaña "Proyectos" y también en línea
 * desde el diálogo de movimiento ("crear proyecto nuevo…"): en ese caso
 * `onCreated` recibe el proyecto recién creado para engancharlo al
 * movimiento sin cerrar el formulario padre.
 */
export function ProjectFormDialog({
  project,
  open,
  onOpenChange,
  onSaved,
  onCreated,
}: {
  /** null = crear; un proyecto = editar. */
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onCreated?: (project: Project) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el proyecto cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setClientName(project?.clientName ?? "");
    setStatus(project?.status ?? "ACTIVE");
    setNotes(project?.notes ?? "");
    setError(null);
  }, [open, project]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(tt("proj_name_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        clientName: clientName.trim() || null,
        status,
        notes: notes.trim() || null,
      };
      if (project) {
        await updateProjectAction(project.id, payload);
      } else {
        const created = await createProjectAction(payload);
        onCreated?.(created);
      }
      toast.success(tt("proj_saved"));
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? tt("proj_dlg_edit_title") : tt("proj_dlg_add_title")}</DialogTitle>
          <DialogDescription>{tt("projects_subtitle")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={tt("proj_f_name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tt("proj_f_name_ph")}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tt("proj_f_client")}>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={tt("f_optional")}
              />
            </Field>
            <Field label={tt("proj_f_status")}>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{tt("proj_status_active")}</SelectItem>
                  <SelectItem value="COMPLETED">{tt("proj_status_completed")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={tt("proj_f_notes")}>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tt("saving") : project ? tt("action_save") : tt("action_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
