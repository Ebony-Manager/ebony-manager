"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { Project } from "@/types/contractors";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap text-sm text-foreground">{value}</span>
    </div>
  );
}

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

  const hasContract = Boolean(
    project &&
      (project.scope ||
        project.furnitureType ||
        project.materialColor ||
        project.specs ||
        project.paymentTerms ||
        project.totalMt2 != null)
  );

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
            <div className="rounded-none border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {project.notes}
            </div>
          )}

          {/* Contrato */}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground">{tt("proj_contract_section")}</h3>
            {hasContract ? (
              <div className="grid grid-cols-1 gap-4 rounded-none border border-border p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ProfileField label={tt("proj_f_scope")} value={project?.scope} />
                </div>
                <ProfileField label={tt("proj_f_furniture_type")} value={project?.furnitureType} />
                <ProfileField label={tt("proj_f_material_color")} value={project?.materialColor} />
                <div className="sm:col-span-2">
                  <ProfileField label={tt("proj_f_specs")} value={project?.specs} />
                </div>
                <ProfileField label={tt("proj_f_payment_terms")} value={project?.paymentTerms} />
                <ProfileField
                  label={tt("proj_f_total_mt2")}
                  value={project?.totalMt2 != null ? `${project.totalMt2} m²` : null}
                />
              </div>
            ) : (
              <p className="rounded-none border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                {tt("proj_contract_empty")}
              </p>
            )}
          </div>

          {/* Zona de peligro */}
          <div className="flex flex-col gap-2 rounded-none border border-destructive/40 bg-destructive/5 p-4">
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
