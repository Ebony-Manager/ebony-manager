"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { Project, ProjectStatus } from "@/types/contractors";
import type { Client, ClientKind } from "@/types/ventas";
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
import { getProjectPeopleAction } from "../proyectos/people-actions";
import { ClientPicker } from "../cotizacion/ventas-common";
import { ClientDialog } from "../cotizacion/clientes/client-dialog";
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
  const [designerId, setDesignerId] = React.useState<string | null>(null);
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [canCreate, setCanCreate] = React.useState(false);
  const [newClient, setNewClient] = React.useState<{ name: string; kind: ClientKind } | null>(null);
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
    setDesignerId(project?.designerId ?? null);
    setClientId(project?.clientId ?? null);
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

  // La lista de arquitectos/diseñadores y clientes finales, al abrir.
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    void getProjectPeopleAction().then((r) => {
      if (!alive) return;
      setClients(r.clients);
      setCanCreate(r.canCreate);
    }, () => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  const nameOf = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name : null);

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
        designerId,
        clientId,
        // Lo que muestran las listas: "Firma · Cliente final" (o el texto que ya tenía).
        clientName: [nameOf(designerId), nameOf(clientId)].filter(Boolean).join(" · ") || (designerId || clientId ? null : (project?.clientName ?? null)),
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
            <Field label={tt("proj_f_designer")}>
              <PersonPicker
                clients={clients}
                kind="arquitecto"
                value={designerId}
                onChange={setDesignerId}
                onCreate={canCreate ? async (n) => setNewClient({ name: n, kind: "arquitecto" }) : undefined}
                placeholder={tt("proj_pick_designer")}
                removeLabel={tt("proj_remove")}
              />
            </Field>
            <Field label={tt("proj_f_end_client")}>
              <PersonPicker
                clients={clients}
                kind="cliente"
                value={clientId}
                onChange={setClientId}
                onCreate={canCreate ? async (n) => setNewClient({ name: n, kind: "cliente" }) : undefined}
                placeholder={tt("proj_pick_client")}
                removeLabel={tt("proj_remove")}
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
      <ClientDialog
        client={newClient}
        clients={clients}
        opportunities={[]}
        projects={[]}
        onClose={() => setNewClient(null)}
        onCreated={(c) => {
          setClients((list) => [...list, c]);
          if (c.kind === "arquitecto") setDesignerId(c.id);
          else setClientId(c.id);
        }}
      />
    </Dialog>
  );
}

/** Elegir arquitecto/diseñador o cliente final, con "Quitar" en rojo. */
function PersonPicker({
  removeLabel,
  ...props
}: React.ComponentProps<typeof ClientPicker> & { onChange: (id: string | null) => void; removeLabel: string }) {
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <ClientPicker {...props} />
      </div>
      {props.value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => props.onChange(null)}
          className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {removeLabel}
        </Button>
      )}
    </div>
  );
}
