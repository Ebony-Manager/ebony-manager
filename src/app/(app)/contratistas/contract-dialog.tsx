"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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
  const [scope, setScope] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [prepaid, setPrepaid] = React.useState("");
  const [work, setWork] = React.useState<WorkDraft>(EMPTY_WORK);
  // Al editar: sus movimientos de valor. Con uno solo (o ninguno) las
  // piezas se editan acá; con varios (historia vieja) se listan.
  const [valueEntries, setValueEntries] = React.useState<ContractorLedgerEntry[] | null>(null);
  const [extraProjects, setExtraProjects] = React.useState<Project[]>([]);
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setExtraProjects([]);
    setContractorId(contract?.contractorId ?? fixedContractor?.id ?? null);
    setProjectId(contract?.projectId ?? defaultProjectId ?? null);
    setName(contract?.name ?? "");
    setContractDate(contract?.contractDate ?? todayInPanama());
    setStatus(contract?.status ?? "ACTIVE");
    setScope(contract?.scope ?? "");
    setPaymentTerms(contract?.paymentTerms ?? "");
    setNotes(contract?.notes ?? "");
    setPrepaid("");
    setWork(EMPTY_WORK);
    setValueEntries(contract ? null : []);
  }, [open, contract, fixedContractor, defaultProjectId]);
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
    if (!contractorId) return setError(tt("ct_err_contractor"));
    if (!projectId) return setError(tt("ct_err_project"));
    if (!name.trim()) return setError(tt("ct_err_name"));
    if (editableWork && work.items.length > 0 && workDraftHasEmptyItem(work)) return setError(tt("mov_item_qty_required"));
    const prepaidCents = Math.round((parseFloat(prepaid || "0") || 0) * 100);
    if (!contract && prepaidCents > workDraftCents(work)) return setError(tt("ct_err_prepaid"));
    setSubmitting(true);
    setError(null);
    const header = {
      projectId,
      name: name.trim(),
      contractDate,
      scope: scope.trim() || null,
      paymentTerms: paymentTerms.trim() || null,
      notes: notes.trim() || null,
    };
    const res = contract
      ? await updateContractAction(contract.id, {
          ...header,
          status,
          ...(editableWork ? { work: workDraftToInput(work), workEntryId } : {}),
        })
      : await createContractAction({ ...header, contractorId, work: workDraftToInput(work), prepaidCents });
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    toast.success(tt("ct_saved"));
    onOpenChange(false);
    onSaved(contract ? contract.id : (res as unknown as { id: string }).id);
  }

  async function onDelete() {
    if (!contract || !window.confirm(tt("ct_delete_confirm"))) return;
    setSubmitting(true);
    const res = await deleteContractAction(contract.id);
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
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
      <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Field label={tt("ct_f_contractor")}>
                {fixedContractor || contract ? (
                  <Input value={person?.name ?? contract?.contractorName ?? ""} disabled />
                ) : (
                  <SearchPicker
                    triggerLabel={person?.name ?? tt("ct_pick_contractor")}
                    searchPlaceholder={tt("search_ph")}
                    emptyText={tt("no_results")}
                    groups={[{ options: contractors.map((c) => ({ id: c.id, label: c.name })) }]}
                    onSelect={(id) => setContractorId(id)}
                  />
                )}
              </Field>
              <Field label={tt("ct_f_project")}>
                <SearchPicker
                  triggerLabel={project?.name ?? tt("ct_pick_project")}
                  searchPlaceholder={tt("proj_search_short")}
                  emptyText={tt("no_results")}
                  groups={projectGroups}
                  onSelect={pickProject}
                  createLabel={tt("ct_new_project")}
                  onCreate={() => setProjectDialogOpen(true)}
                />
              </Field>
              <Field label={tt("ct_f_name")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt("ct_f_name_ph")} />
              </Field>
              <Field label={tt("ct_f_date")}>
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
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                {tt("loading")}
              </p>
            ) : editableWork ? (
              person ? (
                <WorkEditor draft={work} onChange={setWork} rates={rates} />
              ) : (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  {tt("ct_pick_contractor_first")}
                </p>
              )
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <span className="text-xs font-medium text-muted-foreground">{tt("ct_history_title")}</span>
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
              </div>
            )}

            {/* Avance con que arranca: lo que ya se le abonó antes de registrarlo acá. */}
            {!contract && (
              <Field label={tt("ct_f_prepaid")}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={prepaid}
                  onChange={(e) => setPrepaid(e.target.value)}
                  placeholder="0.00"
                  className="max-w-48"
                />
                <p className="text-xs text-muted-foreground">{tt("ct_f_prepaid_hint")}</p>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Field label={tt("ct_f_scope")} className="sm:col-span-2">
                <Textarea rows={2} value={scope} onChange={(e) => setScope(e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("proj_f_payment_terms")}>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("mov_f_notes")}>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tt("f_optional")} />
              </Field>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2 sm:justify-between">
              {contract ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  disabled={submitting}
                >
                  <Trash2 className="size-3.5" />
                  {tt("ct_delete")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  {tt("action_cancel")}
                </Button>
                <Button type="submit" disabled={submitting || loading}>
                  {submitting ? tt("saving") : contract ? tt("action_save") : tt("ct_create")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
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
