"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type {
  ContractorAllocation,
  ContractorContract,
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
  ContractorType,
  LaborRate,
  Project,
} from "@/types/contractors";
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
import { directionForCategory, isMaterialCategory } from "@/lib/contractors/contractor-ledger";
import { contractPendingCents, sortContracts } from "@/lib/contractors/contracts";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLedgerEntryAction, getLedgerEntryItemsAction, updateLedgerEntryAction } from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { Field } from "./field";
import { ContractDialog } from "./contract-dialog";
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

/** Lo que se registra desde acá. Préstamo, adelanto, herramienta, daño,
 *  InDrive y otros descuentos van por Préstamos y descuentos (con cuotas);
 *  el pago, por "Registrar pago" (repartido entre contratos). */
const NEW_ENTRY_CATEGORIES: ContractorLedgerCategory[] = ["trabajo", "extra", "bono", "material", "gasto_operativo", "ajuste"];

/** Categorías que son parte del VALOR de un contrato. */
const VALUE_CATEGORIES = new Set<ContractorLedgerCategory>(["trabajo", "extra", "bono", "ajuste"]);
/** Lo que baja el saldo y se puede abonar a un contrato desde acá. */
const ALLOCATABLE_CATEGORIES = new Set<ContractorLedgerCategory>(["material", "gasto_operativo"]);

/**
 * Crear o editar un movimiento del estado de cuenta de un contratista.
 *
 * REGLA DE DIRECCIÓN: la categoría fija sola si el movimiento sube o baja
 * el saldo (`directionForCategory`); solo en "Ajuste" se pregunta.
 *
 * CONTRATO: un trabajo (y un extra, bono o ajuste) se engancha a un
 * contrato — es parte de su valor, y el proyecto sale del contrato. Un
 * material o gasto se puede abonar a un contrato. Lo viejo sin contrato
 * conserva su proyecto al editarlo.
 */
export function LedgerEntryDialog({
  contractorId,
  contractorName,
  contractorType,
  laborRates,
  entry,
  projects,
  contracts,
  allocations,
  open,
  onOpenChange,
  onSaved,
  onContractsChanged,
  onProjectsChanged,
}: {
  contractorId: string;
  contractorName: string;
  /** Filtra el catálogo de ítems al tipo de ESTE contratista. */
  contractorType: ContractorType;
  /** Catálogo completo de tarifas; se filtra por tipo + activas acá. */
  laborRates: LaborRate[];
  /** null = crear; una entrada = editar. */
  entry: ContractorLedgerEntry | null;
  projects: Project[];
  /** Contratos de ESTE contratista. */
  contracts: ContractorContract[];
  /** Abonos de ESTE contratista. */
  allocations: ContractorAllocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Recargar los contratos del padre tras crear uno en línea. */
  onContractsChanged: () => void;
  onProjectsChanged: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [category, setCategory] = React.useState<ContractorLedgerCategory>("trabajo");
  const [adjustDirection, setAdjustDirection] = React.useState<ContractorLedgerDirection>("a_favor");
  const [work, setWork] = React.useState<WorkDraft>(EMPTY_WORK);
  const [entryDate, setEntryDate] = React.useState(todayInPanama());
  const [contractId, setContractId] = React.useState<string | null>(null);
  const [allocContractId, setAllocContractId] = React.useState<string | null>(null);
  const [allocTouched, setAllocTouched] = React.useState(false);
  const [clientText, setClientText] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [ebonyAbsorbs, setEbonyAbsorbs] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [contractDialogOpen, setContractDialogOpen] = React.useState(false);

  // Abonos de este movimiento (si baja el saldo): a qué contratos fue.
  const entryAllocations = React.useMemo(
    () => (entry ? allocations.filter((a) => a.sourceEntryId === entry.id) : []),
    [entry, allocations]
  );
  const allocatedContracts = [...new Set(entryAllocations.map((a) => a.contractId ?? `credit:${a.creditEntryId}`))];
  const splitAllocation = allocatedContracts.length > 1 || allocatedContracts.some((k) => k.startsWith("credit:"));

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir; la entrada editada cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setAllocTouched(false);
    if (entry) {
      setCategory(entry.category);
      setAdjustDirection(entry.direction);
      // Las piezas (si las hay) llegan aparte, en el efecto de abajo.
      setWork(workDraftFrom(entry, []));
      setEntryDate(entry.entryDate);
      setContractId(entry.contractId);
      setClientText(entry.clientText ?? "");
      setDescription(entry.description ?? "");
      setNotes(entry.notes ?? "");
      setEbonyAbsorbs(entry.ebonyAbsorbsMaterial);
    } else {
      setCategory("trabajo");
      setAdjustDirection("a_favor");
      setWork(EMPTY_WORK);
      setEntryDate(todayInPanama());
      setContractId(null);
      setClientText("");
      setDescription("");
      setNotes("");
      setEbonyAbsorbs(false);
    }
  }, [open, entry]);
  React.useEffect(() => {
    if (!open) return;
    setAllocContractId(entryAllocations.length > 0 && !splitAllocation ? entryAllocations[0].contractId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open, entry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Al editar un trabajo, sus piezas guardadas (con los valores congelados).
  React.useEffect(() => {
    if (!open || !entry || entry.category !== "trabajo") return;
    let cancelled = false;
    getLedgerEntryItemsAction(entry.id).then((loaded) => {
      if (!cancelled && loaded.length > 0) setWork(workDraftFrom(entry, loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

  const fixedDirection = directionForCategory(category);
  const direction = fixedDirection ?? adjustDirection;
  const showMaterialToggle = isMaterialCategory(category);
  const isWorkCategory = category === "trabajo";
  const isValue = VALUE_CATEGORIES.has(category);
  const isAllocatable = ALLOCATABLE_CATEGORIES.has(category) && !ebonyAbsorbs;
  const contractRequired = isWorkCategory && !entry;

  const categories = entry && !NEW_ENTRY_CATEGORIES.includes(entry.category)
    ? [...NEW_ENTRY_CATEGORIES, entry.category]
    : NEW_ENTRY_CATEGORIES;

  const activeRates = React.useMemo(
    () => laborRates.filter((r) => r.contractorType === contractorType && r.activo),
    [laborRates, contractorType]
  );
  const computedCents = workDraftCents(isWorkCategory ? work : { ...work, items: [] });

  const sorted = sortContracts(contracts);
  const contractGroups = (withPending: boolean) => [
    {
      options: sorted
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          id: c.id,
          label: c.projectName !== c.name ? `${c.name} · ${c.projectName}` : c.name,
          hint: withPending ? formatCents(contractPendingCents(c)) : undefined,
        })),
    },
    {
      heading: tt("proj_completed_section"),
      options: sorted
        .filter((c) => c.status !== "ACTIVE")
        .map((c) => ({ id: c.id, label: c.projectName !== c.name ? `${c.name} · ${c.projectName}` : c.name, muted: true })),
    },
  ];
  const contractLabel = (id: string | null, none: string) => {
    if (!id) return none;
    const c = contracts.find((x) => x.id === id);
    return c ? (c.projectName !== c.name ? `${c.name} · ${c.projectName}` : c.name) : tt("ct_new_one");
  };

  function onCategoryChange(next: ContractorLedgerCategory) {
    setCategory(next);
    if (!isMaterialCategory(next)) setEbonyAbsorbs(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isWorkCategory && work.items.length > 0 && workDraftHasEmptyItem(work)) {
      setError(tt("mov_item_qty_required"));
      return;
    }
    if (computedCents <= 0) {
      setError(tt("mov_amount_required"));
      return;
    }
    if (contractRequired && !contractId) {
      setError(tt("mov_contract_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const amount = isWorkCategory ? workDraftToInput(work) : workDraftToInput({ ...work, items: [] });
    const valueContract = isValue ? contractId : null;
    try {
      const input = {
        // Sin contrato, lo viejo conserva su proyecto.
        projectId: valueContract ? null : (entry?.projectId ?? null),
        contractId: valueContract,
        entryDate,
        category,
        direction,
        mt2: amount.mt2,
        costPerMt2Cents: amount.costPerMt2Cents,
        amountCents: amount.amountCents,
        ebonyAbsorbsMaterial: showMaterialToggle ? ebonyAbsorbs : false,
        clientText: clientText.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        items: isWorkCategory ? amount.items : [],
        // El abono a contrato solo se manda si se eligió o cambió acá.
        ...(isAllocatable && (!entry || allocTouched) ? { allocateToContractId: allocContractId } : {}),
      };
      if (entry) {
        await updateLedgerEntryAction(entry.id, input);
      } else {
        await createLedgerEntryAction({ contractorId, ...input });
      }
      toast.success(tt("mov_saved"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-[min(95vw,42rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entry ? tt("mov_edit_title") : tt("mov_add_title")}</DialogTitle>
            <DialogDescription>{tt("mov_desc")}</DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tt("mov_f_category")}>
                <Select value={category} onValueChange={(v) => onCategoryChange(v as ContractorLedgerCategory)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(lang, strings.contratistas[CONTRACTOR_CATEGORY_LABEL_KEY[key] as keyof typeof strings.contratistas])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("mov_f_date")}>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </Field>
              {!entry && <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">{tt("mov_where_else")}</p>}

              {/* Dirección: solo se pregunta en "Ajuste". */}
              {fixedDirection === null && (
                <Field label={tt("mov_f_adjust_dir")} className="sm:col-span-2">
                  <Select value={adjustDirection} onValueChange={(v) => setAdjustDirection(v as ContractorLedgerDirection)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_favor">{tt("adjust_a_favor")}</SelectItem>
                      <SelectItem value="reduce">{tt("adjust_reduce")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* Trabajo / extra / bono / ajuste: parte del valor de un contrato. */}
              {isValue && (
                <Field label={contractRequired ? tt("mov_f_contract") : tt("mov_f_contract_optional")} className="sm:col-span-2">
                  <SearchPicker
                    triggerLabel={contractLabel(contractId, contractRequired ? tt("ct_pick_contract") : tt("mov_no_contract"))}
                    searchPlaceholder={tt("ct_search_ph")}
                    emptyText={tt("no_results")}
                    groups={contractGroups(false)}
                    noneLabel={contractRequired ? undefined : tt("mov_no_contract")}
                    onSelect={setContractId}
                    createLabel={tt("ct_add")}
                    onCreate={() => setContractDialogOpen(true)}
                  />
                </Field>
              )}

              {/* Material / gasto: se puede abonar a un contrato. */}
              {isAllocatable && (
                <Field label={tt("mov_f_alloc_contract")} className="sm:col-span-2">
                  {entry && splitAllocation && !allocTouched ? (
                    <p className="text-xs text-muted-foreground">{tt("mov_alloc_split")}</p>
                  ) : (
                    <SearchPicker
                      triggerLabel={contractLabel(allocContractId, tt("mov_alloc_none"))}
                      searchPlaceholder={tt("ct_search_ph")}
                      emptyText={tt("no_results")}
                      groups={contractGroups(true)}
                      noneLabel={tt("mov_alloc_none")}
                      onSelect={(id) => {
                        setAllocContractId(id);
                        setAllocTouched(true);
                      }}
                    />
                  )}
                </Field>
              )}
            </div>

            <WorkEditor draft={work} onChange={setWork} rates={activeRates} showItems={isWorkCategory} />

            {showMaterialToggle && (
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={ebonyAbsorbs}
                  onChange={(e) => setEbonyAbsorbs(e.target.checked)}
                  className="mt-0.5 size-4 rounded-lg border-input accent-primary"
                />
                <span>
                  <span className="font-medium text-foreground">{tt("mov_f_ebony_absorbs")}</span>
                  <span className="block text-xs text-muted-foreground">{tt("mov_f_ebony_absorbs_hint")}</span>
                </span>
              </label>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Field label={tt("mov_f_client_note")}>
                <Input value={clientText} onChange={(e) => setClientText(e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("mov_f_description")}>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("mov_f_notes")} className="sm:col-span-2">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {tt("action_cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? tt("saving") : entry ? tt("action_save") : tt("action_add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ContractDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        contract={null}
        contractors={[]}
        fixedContractor={{ id: contractorId, name: contractorName, contractorType }}
        projects={projects}
        laborRates={laborRates}
        onSaved={() => {
          // El contrato nuevo ya trae sus piezas (su valor): no hace falta
          // además este movimiento.
          onContractsChanged();
          onSaved();
          onOpenChange(false);
        }}
        onProjectsChanged={onProjectsChanged}
      />
    </>
  );
}
