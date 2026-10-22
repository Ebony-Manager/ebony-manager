"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

import type { ContractorContract, Project } from "@/types/contractors";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/planilla/payroll-period";
import { contractPendingCents, sortContracts } from "@/lib/contractors/contracts";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractsTable } from "./contracts-table";

/**
 * Ficha del proyecto: el resumen de sus contratos (valor, abonado,
 * pendiente) y la lista de ellos — el proyecto es el padre, los contratos
 * los hijos. Tocar un contrato lo abre; "Nuevo contrato" lo crea con este
 * proyecto ya elegido. Editar abre `ProjectFormDialog`; borrar abre
 * `DeleteProjectDialog` — la lógica vive en el padre (`ProjectsView`).
 */
export function ProjectDetailSheet({
  project,
  contracts,
  onOpenContract,
  onAddContract,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  project: Project | null;
  /** Los contratos de este proyecto. */
  contracts: ContractorContract[];
  onOpenContract: (c: ContractorContract) => void;
  onAddContract: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [showCompleted, setShowCompleted] = React.useState(false);

  const sorted = React.useMemo(() => sortContracts(contracts), [contracts]);
  const active = sorted.filter((c) => c.status === "ACTIVE");
  const completed = sorted.filter((c) => c.status !== "ACTIVE");
  const totals = React.useMemo(
    () => ({
      value: contracts.reduce((s, c) => s + c.valueCents, 0),
      paid: contracts.reduce((s, c) => s + c.allocatedCents, 0),
      pending: contracts.reduce((s, c) => s + Math.max(0, contractPendingCents(c)), 0),
    }),
    [contracts]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
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

          {/* Contratos del proyecto */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">{tt("proj_contracts")}</h3>
              <Button size="sm" onClick={onAddContract} disabled={!project}>
                <Plus className="size-3.5" />
                {tt("ct_add")}
              </Button>
            </div>

            {contracts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-6 text-center text-sm text-muted-foreground">
                {tt("proj_no_contracts")}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label={tt("ct_col_value")} value={formatCents(totals.value)} />
                  <Stat label={tt("ct_col_paid")} value={formatCents(totals.paid)} />
                  <Stat label={tt("ct_col_pending")} value={formatCents(totals.pending)} strong />
                </div>

                {active.length > 0 ? (
                  <ContractsTable contracts={active} onOpen={onOpenContract} showContractor />
                ) : (
                  <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-4 text-center text-sm text-muted-foreground">
                    {tt("ct_no_active")}
                  </div>
                )}
                {completed.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCompleted((v) => !v)}
                      className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {showCompleted ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      {tt("proj_completed_section")} ({completed.length})
                    </button>
                    {showCompleted && (
                      <ContractsTable contracts={completed} onOpen={onOpenContract} showContractor />
                    )}
                  </div>
                )}
              </>
            )}
          </div>

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

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular-nums ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
