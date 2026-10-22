"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { Project } from "@/types/contractors";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/**
 * Ficha del proyecto (Etapa 2-A · Parte 1): datos básicos + la ficha de
 * CONTRATO (alcance, tipo de mueble, color, especificaciones, acuerdo de
 * pago, m² totales) en modo lectura. Los campos vacíos no se muestran.
 * Editar abre `ProjectFormDialog`; borrar abre `DeleteProjectDialog` — la
 * lógica vive en el padre (`ProjectsView`).
 *
 * Las asignaciones de contratistas (fechas, m² por persona) llegan en la
 * Parte 2 y se agregan como una sección más de esta ficha.
 */
export function ProjectDetailSheet({
  project,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {project?.name ?? ""}
            {project && (
              <Badge variant={project.status === "ACTIVE" ? "secondary" : "outline"}>
                {project.status === "ACTIVE"
                  ? tt("proj_status_active")
                  : tt("proj_status_completed")}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>{project?.clientName || tt("proj_col_client")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onEdit} disabled={!project}>
              <Pencil className="size-3.5" />
              {tt("action_edit")}
            </Button>
          </div>

          {project?.notes && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {project.notes}
            </div>
          )}

          {/* Zona de peligro */}
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <h3 className="text-sm font-medium text-destructive">{tt("proj_delete_title")}</h3>
            <p className="text-xs text-muted-foreground">{tt("proj_delete_keeps_moves")}</p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-1 self-start"
              onClick={onDelete}
              disabled={!project}
            >
              <Trash2 className="size-3.5" />
              {tt("proj_delete_confirm")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
