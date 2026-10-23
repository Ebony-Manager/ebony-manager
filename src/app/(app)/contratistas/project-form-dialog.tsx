"use client";

import * as React from "react";
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

/** "12.5" → 12.5 ; vacío o no-número o negativo → null. */
function parseMt2(value: string): number | null {
  const n = parseFloat(value.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Alta / edición de un proyecto de Ebony: ficha básica (nombre, cliente,
 * estado, notas) + los campos de "contrato" de la Etapa 2-A (alcance,
 * tipo de mueble, color del material, especificaciones, acuerdo de pago,
 * m² totales) — todos opcionales. Se usa desde la pestaña "Proyectos" y
 * en línea desde el diálogo de movimiento ("crear proyecto nuevo…"): en
 * ese caso `onCreated` recibe el proyecto recién creado.
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

  const [name, setName] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE");
  const [notes, setNotes] = React.useState("");
  // Contrato (Etapa 2-A) — todo texto salvo m² totales.
  const [scope, setScope] = React.useState("");
  const [furnitureType, setFurnitureType] = React.useState("");
  const [materialColor, setMaterialColor] = React.useState("");
  const [specs, setSpecs] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("");
  const [totalMt2, setTotalMt2] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el proyecto cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setClientName(project?.clientName ?? "");
    setLocation(project?.location ?? "");
    setStatus(project?.status ?? "ACTIVE");
    setNotes(project?.notes ?? "");
    setScope(project?.scope ?? "");
    setFurnitureType(project?.furnitureType ?? "");
    setMaterialColor(project?.materialColor ?? "");
    setSpecs(project?.specs ?? "");
    setPaymentTerms(project?.paymentTerms ?? "");
    setTotalMt2(project?.totalMt2 != null ? String(project.totalMt2) : "");
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
        location: location.trim() || null,
        status,
        notes: notes.trim() || null,
        scope: scope.trim() || null,
        furnitureType: furnitureType.trim() || null,
        materialColor: materialColor.trim() || null,
        specs: specs.trim() || null,
        paymentTerms: paymentTerms.trim() || null,
        totalMt2: parseMt2(totalMt2),
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
          <Field label={tt("proj_f_location")}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tt("proj_f_location_ph")} />
          </Field>
          <Field label={tt("proj_f_notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
