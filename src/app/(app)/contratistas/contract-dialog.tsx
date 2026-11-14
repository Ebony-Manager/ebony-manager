"use client";

import * as React from "react";
import { LoadingBlock } from "@/components/shared/loading-block";
import { History } from "lucide-react";
import toast from "react-hot-toast";

import type { ContractorContract, ContractorLedgerEntry, ContractorType, LaborRate, Project } from "@/types/contractors";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import { contractProgressPct } from "@/lib/contractors/contracts";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  createContractAction,
  deleteContractAction,
  getContractWorkAction,
  getLedgerEntryItemsAction,
  updateContractAction,
} from "./actions";
import { Field } from "./field";
import { ProjectFormDialog } from "./project-form-dialog";
import { SearchPicker } from "./search-picker";
import {
  EMPTY_WORK,
  WorkEditor,
  workDraftCents,
  workDraftFrom,
  workDraftHasEmptyItem,
  workDraftToInput,
  type WorkDraft,
} from "./work-editor";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/page-header";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";

export interface ContractPerson {
  id: string;
  name: string;
  contractorType: ContractorType;
}

/**
 * Crear o editar un contrato: proyecto, contratista, nombre y sus piezas
 * con medidas (el valor acordado). Se puede editar en todo momento, aunque
 * ya tenga abonos — las medidas reales pueden diferir del plano por
 * centímetros. Si el valor baja de lo ya abonado, lo que sobra queda a
 * cuenta para el próximo pago.
 */
export function ContractDialog({
  open,
  onOpenChange,
  contract,
  contractors,
  fixedContractor,
  defaultProjectId,
  projects,
  laborRates,
  onSaved,
  onProjectsChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = crear. */
  contract: ContractorContract | null;
  /** Para elegir contratista al crear (si no viene `fixedContractor`). */
  contractors: ContractPerson[];
  fixedContractor?: ContractPerson;
  /** Al crear desde la ficha de un proyecto: ese proyecto ya elegido. */
  defaultProjectId?: string | null;
  projects: Project[];
  laborRates: LaborRate[];
  /** Al crear trae el id del contrato nuevo. */
  onSaved: (contractId?: string) => void;
  onProjectsChanged?: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [contractorId, setContractorId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [contractDate, setContractDate] = React.useState(todayInPanama());
  const [status, setStatus] = React.useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [notes, setNotes] = React.useState("");
  const [prepaid, setPrepaid] = React.useState("");
  const [work, setWork] = React.useState<WorkDraft>(EMPTY_WORK);
  // Al editar: sus movimientos de valor. Con uno solo (o ninguno) las
  // piezas se editan acá; con varios (historia vieja) se listan.
  const [valueEntries, setValueEntries] = React.useState<ContractorLedgerEntry[] | null>(null);
  const [extraProjects, setExtraProjects] = React.useState<Project[]>([]);
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"contractor" | "project" | "name" | "items" | "prepaid">();
  const initial = React.useRef("");
  const seeded = React.useRef(false);
  const snapshot = () => JSON.stringify([contractorId, projectId, name, contractDate, status, notes, prepaid, work]);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir. */
  React.useEffect(() => {
    if (!open) return;
    reset();
    seeded.current = true;
    setExtraProjects([]);
    setContractorId(contract?.contractorId ?? fixedContractor?.id ?? null);
    setProjectId(contract?.projectId ?? defaultProjectId ?? null);
    setName(contract?.name ?? "");
    setContractDate(contract?.contractDate ?? todayInPanama());
    setStatus(contract?.status ?? "ACTIVE");
    setNotes(contract?.notes ?? "");
    setPrepaid("");
    setWork(EMPTY_WORK);
    setValueEntries(contract ? null : []);
  }, [open, contract, fixedContractor, defaultProjectId, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (!open || !contract) return;
    let cancelled = false;
    getContractWorkAction(contract.id).then(async (entries) => {
      if (cancelled) return;
      const single = entries.length === 1 && entries[0].category === "trabajo" ? entries[0] : null;
      if (single) {
        const items = await getLedgerEntryItemsAction(single.id);
        if (cancelled) return;
        setWork(workDraftFrom(single, items));
      }
      setValueEntries(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [open, contract]);

  // Después de sembrar el formulario al abrir (y de que lleguen sus piezas), se anota cómo quedó.
  React.useEffect(() => {
    if (seeded.current && (valueEntries !== null || !contract)) {
      seeded.current = false;
      initial.current = snapshot();
    }
  });
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => snapshot() !== initial.current, () => onOpenChange(false));

  const person = fixedContractor ?? contractors.find((c) => c.id === contractorId) ?? null;
  const rates = React.useMemo(
    () => laborRates.filter((r) => person && r.contractorType === person.contractorType && r.activo),
    [laborRates, person]
  );

  const allProjects = React.useMemo(() => {
    const byId = new Map<string, Project>();
    for (const p of [...projects, ...extraProjects]) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, extraProjects]);
  const project = allProjects.find((p) => p.id === projectId) ?? null;

  const loading = valueEntries === null;
  // Piezas editables acá: contrato nuevo, o con un solo movimiento de trabajo (o ninguno).
  const editableWork = !loading && (valueEntries.length === 0 || (valueEntries.length === 1 && valueEntries[0].category === "trabajo"));
  const workEntryId = editableWork && valueEntries.length === 1 ? valueEntries[0].id : null;
  const valueCents = editableWork ? workDraftCents(work) : (contract?.valueCents ?? 0);
  const allocatedCents = contract?.allocatedCents ?? 0;

  function pickProject(id: string | null) {
    setProjectId(id);
    const p = allProjects.find((x) => x.id === id);
    if (p && !name.trim()) setName(p.name);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emptyItem = editableWork && work.items.length > 0 && workDraftHasEmptyItem(work);
    const prepaidCents = Math.round((parseFloat(prepaid || "0") || 0) * 100);
    if (
      !validate([
        ["contractor", !contractorId, tt("ct_err_contractor")],
        ["project", !projectId, tt("ct_err_project")],
        ["name", !name.trim(), tt("ct_err_name")],
        ["items", emptyItem, tt("mov_item_qty_required")],
        ["prepaid", !contract && prepaidCents > workDraftCents(work), tt("ct_err_prepaid")],
      ])
    )
      return;
    setSubmitting(true);
    const header = {
      projectId: projectId!,
      name: name.trim(),
      contractDate,
      notes: notes.trim() || null,
    };
    const res = contract
      ? await updateContractAction(contract.id, {
          ...header,
          status,
          ...(editableWork ? { work: workDraftToInput(work), workEntryId } : {}),
        })
      : await createContractAction({ ...header, contractorId: contractorId!, work: workDraftToInput(work), prepaidCents });
    setSubmitting(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("ct_saved"));
    onOpenChange(false);
    onSaved(contract ? contract.id : (res as unknown as { id: string }).id);
  }

  async function onDelete() {
    if (!contract) return;
    setSubmitting(true);
    const res = await deleteContractAction(contract.id);
    setSubmitting(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("ct_deleted"));
    onOpenChange(false);
    onSaved();
  }

  const projectGroups = [
    { options: allProjects.filter((p) => p.status === "ACTIVE").map((p) => ({ id: p.id, label: p.name })) },
    {
      heading: tt("proj_completed_section"),
      options: allProjects.filter((p) => p.status !== "ACTIVE").map((p) => ({ id: p.id, label: p.name, muted: true })),
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
        <DialogContent className="max-h-[90vh] max-w-[min(95vw,44rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{contract ? tt("ct_edit_title") : tt("ct_add_title")}</DialogTitle>
            <DialogDescription>{tt("ct_desc")}</DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {contract && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
                <Stat label={tt("ct_col_value")} value={formatCents(valueCents)} />
                <Stat label={tt("ct_col_paid")} value={formatCents(allocatedCents)} />
                <Stat
                  label={valueCents - allocatedCents < 0 ? tt("ct_overpaid") : tt("ct_col_pending")}
                  value={formatCents(Math.abs(valueCents - allocatedCents))}
                />
                <Stat label={tt("ct_col_progress")} value={`${contractProgressPct({ valueCents, allocatedCents })} %`} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tt("ct_f_contractor")} required error={error("contractor")}>
                {fixedContractor || contract ? (
                  <Input value={person?.name ?? contract?.contractorName ?? ""} disabled />
                ) : (
                  <SearchPicker
                    triggerLabel={person?.name ?? tt("ct_pick_contractor")}
                    searchPlaceholder={tt("search_ph")}
                    emptyText={tt("no_results")}
                    groups={[{ options: contractors.map((c) => ({ id: c.id, label: c.name })) }]}
                    onSelect={(id) => {
                      setContractorId(id);
                      clear("contractor");
                    }}
                  />
                )}
              </Field>
              <Field label={tt("ct_f_project")} required error={error("project")}>
                <SearchPicker
                  triggerLabel={project?.name ?? tt("ct_pick_project")}
                  searchPlaceholder={tt("proj_search_short")}
                  emptyText={tt("no_results")}
                  groups={projectGroups}
                  onSelect={(id) => {
                    pickProject(id);
                    clear("project");
                  }}
                  createLabel={tt("ct_new_project")}
                  onCreate={() => setProjectDialogOpen(true)}
                />
              </Field>
              <Field label={tt("ct_f_name")} required error={error("name")}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clear("name");
                  }} placeholder={tt("ct_f_name_ph")} />
              </Field>
              <Field label={tt("ct_f_date")} icon={ICON.date}>
                <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
              </Field>
              {contract && (
                <Field label={tt("proj_f_status")}>
                  <Select value={status} onValueChange={(v) => setStatus(v as "ACTIVE" | "COMPLETED")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{tt("proj_status_active")}</SelectItem>
                      <SelectItem value="COMPLETED">{tt("proj_status_completed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            {loading ? (
              <LoadingBlock rows={4} />
            ) : editableWork ? (
              person ? (
                <WorkEditor
                  draft={work}
                  onChange={(next) => {
                    setWork(next);
                    clear("items");
                    clear("prepaid");
                  }}
                  rates={rates}
                  itemsError={error("items")}
                />
              ) : (
                <EmptyState>
                  {tt("ct_pick_contractor_first")}
                </EmptyState>
              )
            ) : (
              <FormSection icon={History} title={tt("ct_history_title")}>
                <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto text-xs">
                  {valueEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-1.5">
                      <span className="w-16 shrink-0 text-muted-foreground">{formatDateCompact(lang, e.entryDate)}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground" title={e.itemsSummary ?? e.description ?? undefined}>
                        {e.itemsSummary ?? e.description ?? "—"}
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {e.direction === "reduce" ? "−" : ""}
                        {formatCents(e.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{tt("ct_history_hint")}</p>
              </FormSection>
            )}

            {/* Avance con que arranca: lo que ya se le abonó antes de registrarlo acá. */}
            {!contract && (
              <Field label={tt("ct_f_prepaid")} error={error("prepaid")}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={prepaid}
                  onChange={(e) => {
                    setPrepaid(e.target.value);
                    clear("prepaid");
                  }}
                  placeholder="0.00"
                  className="max-w-48"
                />
                <p className="text-xs text-muted-foreground">{tt("ct_f_prepaid_hint")}</p>
              </Field>
            )}

            <Field label={tt("mov_f_notes")}>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <DialogFooter className="gap-2 sm:justify-between">
              {contract ? (
                <ConfirmButton
                  className="text-muted-foreground"
                  label={tt("ct_delete")}
                  confirmLabel={t(lang, strings.nav.confirm_delete)}
                  disabled={submitting}
                  onConfirm={() => void onDelete()}
                />
              ) : (
                <span />
              )}
              <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={submitting}>
                {tt("action_cancel")}
              </Button>
              <Button type="submit" disabled={submitting || loading}>
                {submitting ? tt("saving") : contract ? tt("action_save") : tt("ct_create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
        {discardDialog}
      </Dialog>

      <ProjectFormDialog
        project={null}
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onCreated={(p) => {
          setExtraProjects((cur) => [...cur, p]);
          setProjectId(p.id);
          if (!name.trim()) setName(p.name);
          onProjectsChanged?.();
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
