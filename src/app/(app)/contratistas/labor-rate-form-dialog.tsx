"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { ContractorType, LaborRate, LaborRatePhase, LaborRateUnit } from "@/types/contractors";
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
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLaborRateAction, updateLaborRateAction } from "./actions";
import { Field } from "./field";

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : -1;
}

/**
 * Alta / edición de una tarifa de mano de obra (catálogo `labor_rates`).
 * Un pintor tiene precio único por ítem (sin fase); un ebanista tiene
 * fase obligatoria (armado / instalación) — cambiar el tipo a "pintor"
 * limpia la fase automáticamente.
 */
export function LaborRateFormDialog({
  rate,
  open,
  onOpenChange,
}: {
  /** null = crear; una tarifa = editar. */
  rate: LaborRate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [contractorType, setContractorType] = React.useState<ContractorType>("ebanista");
  const [fase, setFase] = React.useState<LaborRatePhase>("armado");
  const [unidad, setUnidad] = React.useState<LaborRateUnit>("m2");
  const [descripcion, setDescripcion] = React.useState("");
  const [precio, setPrecio] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; la tarifa cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setContractorType(rate?.contractorType ?? "ebanista");
    setFase(rate?.fase ?? "armado");
    setUnidad(rate?.unidad ?? "m2");
    setDescripcion(rate?.descripcion ?? "");
    setPrecio(rate ? (rate.precioCents / 100).toFixed(2) : "");
    setError(null);
  }, [open, rate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) {
      setError(tt("rate_description_required"));
      return;
    }
    const precioCents = toCents(precio);
    if (precioCents < 0) {
      setError(tt("rate_price_invalid"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        contractorType,
        fase: contractorType === "ebanista" ? fase : null,
        unidad,
        descripcion: descripcion.trim(),
        precioCents,
      };
      if (rate) {
        await updateLaborRateAction(rate.id, payload);
      } else {
        await createLaborRateAction(payload);
      }
      toast.success(tt("rate_saved"));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rate ? tt("rate_dlg_edit_title") : tt("rate_dlg_add_title")}</DialogTitle>
          <DialogDescription>{tt("rates_subtitle")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tt("f_type")}>
              <Select
                value={contractorType}
                onValueChange={(v) => {
                  const next = v as ContractorType;
                  setContractorType(next);
                  if (next === "ebanista" && !fase) setFase("armado");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ebanista">{tt("type_ebanista")}</SelectItem>
                  <SelectItem value="pintor">{tt("type_pintor")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={tt("rate_f_unit")}>
              <Select value={unidad} onValueChange={(v) => setUnidad(v as LaborRateUnit)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">{tt("unit_m2")}</SelectItem>
                  <SelectItem value="ml">{tt("unit_ml")}</SelectItem>
                  <SelectItem value="unidad">{tt("unit_unidad")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {contractorType === "ebanista" && (
            <Field label={tt("rate_f_phase")} hint={tt("rate_f_phase_hint")}>
              <Select value={fase} onValueChange={(v) => setFase(v as LaborRatePhase)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="armado">{tt("phase_armado")}</SelectItem>
                  <SelectItem value="instalacion">{tt("phase_instalacion")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label={tt("rate_f_description")}>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={tt("rate_f_description_ph")}
              autoFocus
            />
          </Field>

          <Field label={tt("rate_f_price")}>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0.00"
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tt("saving") : rate ? tt("action_save") : tt("action_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
