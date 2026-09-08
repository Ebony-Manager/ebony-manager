"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import type {
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
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
import {
  CONTRACTOR_LEDGER_CATEGORIES,
  directionForCategory,
  isMaterialCategory,
  lineAmountCents,
} from "@/lib/contractors/contractor-ledger";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLedgerEntryAction, updateLedgerEntryAction } from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { Field } from "./field";

type AmountMode = "flat" | "area";

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function toNum(value: string): number | null {
  const n = parseFloat(value || "");
  return Number.isFinite(n) ? n : null;
}

/**
 * Crear o editar un movimiento del estado de cuenta de un contratista.
 *
 * REGLA DE DIRECCIÓN: la categoría fija sola si el movimiento sube o baja
 * el saldo (`directionForCategory`); ese control NO se le muestra al
 * usuario. Solo en "Ajuste" se le pregunta si suma o resta.
 *
 * El monto va como monto fijo o como m² × costo/m² (se multiplica solo).
 * El interruptor "Ebony asume este material" solo aparece en categoría
 * "Material": el movimiento queda registrado pero no mueve el saldo.
 */
export function LedgerEntryDialog({
  contractorId,
  entry,
  open,
  onOpenChange,
  onSaved,
}: {
  contractorId: string;
  /** null = crear; una entrada = editar. */
  entry: ContractorLedgerEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [category, setCategory] = React.useState<ContractorLedgerCategory>("trabajo");
  const [adjustDirection, setAdjustDirection] = React.useState<ContractorLedgerDirection>("a_favor");
  const [amountMode, setAmountMode] = React.useState<AmountMode>("flat");
  const [flatAmount, setFlatAmount] = React.useState("");
  const [mt2, setMt2] = React.useState("");
  const [costPerMt2, setCostPerMt2] = React.useState("");
  const [entryDate, setEntryDate] = React.useState(today);
  const [clientText, setClientText] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [ebonyAbsorbs, setEbonyAbsorbs] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir; la entrada editada cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (entry) {
      const area = entry.mt2 != null && entry.costPerMt2Cents != null;
      setCategory(entry.category);
      setAdjustDirection(entry.direction);
      setAmountMode(area ? "area" : "flat");
      setFlatAmount(area ? "" : (entry.amountCents / 100).toFixed(2));
      setMt2(entry.mt2 != null ? String(entry.mt2) : "");
      setCostPerMt2(entry.costPerMt2Cents != null ? (entry.costPerMt2Cents / 100).toFixed(2) : "");
      setEntryDate(entry.entryDate);
      setClientText(entry.clientText ?? "");
      setDescription(entry.description ?? "");
      setNotes(entry.notes ?? "");
      setEbonyAbsorbs(entry.ebonyAbsorbsMaterial);
    } else {
      setCategory("trabajo");
      setAdjustDirection("a_favor");
      setAmountMode("flat");
      setFlatAmount("");
      setMt2("");
      setCostPerMt2("");
      setEntryDate(today);
      setClientText("");
      setDescription("");
      setNotes("");
      setEbonyAbsorbs(false);
    }
  }, [open, entry, today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fixedDirection = directionForCategory(category);
  const showMaterialToggle = isMaterialCategory(category);

  function onCategoryChange(next: ContractorLedgerCategory) {
    setCategory(next);
    if (!isMaterialCategory(next)) setEbonyAbsorbs(false);
  }

  const computedCents =
    amountMode === "area"
      ? lineAmountCents({ mt2: toNum(mt2), costPerMt2Cents: toCents(costPerMt2), flatAmountCents: 0 })
      : toCents(flatAmount);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (computedCents <= 0) {
      setError(tt("mov_amount_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        entryDate,
        category,
        direction: fixedDirection ?? adjustDirection,
        mt2: amountMode === "area" ? toNum(mt2) : null,
        costPerMt2Cents: amountMode === "area" ? toCents(costPerMt2) : null,
        amountCents: computedCents,
        ebonyAbsorbsMaterial: showMaterialToggle ? ebonyAbsorbs : false,
        clientText: clientText.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
      };
      if (entry) {
        await updateLedgerEntryAction(entry.id, input);
      } else {
        await createLedgerEntryAction({ contractorId, ...input });
      }
      toast.success(tt("mov_saved"));
      onOpenChange(false);
      onSaved();
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
                  {CONTRACTOR_LEDGER_CATEGORIES.map((key) => (
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

            {/* Dirección: solo se pregunta en "Ajuste". */}
            {fixedDirection === null && (
              <Field label={tt("mov_f_adjust_dir")} className="sm:col-span-2">
                <Select
                  value={adjustDirection}
                  onValueChange={(v) => setAdjustDirection(v as ContractorLedgerDirection)}
                >
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
          </div>

          {/* Monto: fijo o m² × costo/m². */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{tt("mov_f_amount_mode")}:</span>
              <Button
                type="button"
                size="sm"
                variant={amountMode === "flat" ? "default" : "outline"}
                onClick={() => setAmountMode("flat")}
              >
                {tt("amount_mode_flat")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={amountMode === "area" ? "default" : "outline"}
                onClick={() => setAmountMode("area")}
              >
                {tt("amount_mode_area")}
              </Button>
            </div>

            {amountMode === "flat" ? (
              <Field label={tt("mov_f_flat")}>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={flatAmount}
                  onChange={(e) => setFlatAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tt("mov_f_mt2")}>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={mt2}
                      onChange={(e) => setMt2(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label={tt("mov_f_cost_mt2")}>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={costPerMt2}
                      onChange={(e) => setCostPerMt2(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tt("mov_computed")}:{" "}
                  <span className="font-medium text-foreground tabular-nums">{formatCents(computedCents)}</span>
                </p>
              </>
            )}
          </div>

          {showMaterialToggle && (
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={ebonyAbsorbs}
                onChange={(e) => setEbonyAbsorbs(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span>
                <span className="font-medium text-foreground">{tt("mov_f_ebony_absorbs")}</span>
                <span className="block text-xs text-muted-foreground">{tt("mov_f_ebony_absorbs_hint")}</span>
              </span>
            </label>
          )}

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field label={tt("mov_f_client")}>
              <Input value={clientText} onChange={(e) => setClientText(e.target.value)} placeholder={tt("f_optional")} />
            </Field>
            <Field label={tt("mov_f_description")}>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tt("f_optional")}
              />
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
  );
}
