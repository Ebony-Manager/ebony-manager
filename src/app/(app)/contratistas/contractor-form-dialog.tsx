"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import type { ContractorType } from "@/types/contractors";
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
import { createContractorAction } from "./actions";
import { Field } from "./field";

/**
 * Alta de un contratista (ebanista o pintor). Inputs controlados con
 * `useState`, sin react-hook-form/zod — mismo patrón que
 * `employee-form-dialog` de Planilla. En la C1 solo hay alta: editar /
 * inactivar / borrar contratista llega en la C2.
 */

interface FormState {
  name: string;
  contractorType: ContractorType;
  idDocument: string;
  phone: string;
  contactInfo: string;
  startDate: string;
}

const EMPTY: FormState = {
  name: "",
  contractorType: "ebanista",
  idDocument: "",
  phone: "",
  contactInfo: "",
  startDate: "",
};

export function ContractorFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(tt("f_name_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createContractorAction({
        name: form.name.trim(),
        contractorType: form.contractorType,
        idDocument: form.idDocument.trim() || null,
        phone: form.phone.trim() || null,
        contactInfo: form.contactInfo.trim() || null,
        startDate: form.startDate || null,
      });
      toast.success(tt("action_add"));
      onOpenChange(false);
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
          <DialogTitle>{tt("dlg_add_title")}</DialogTitle>
          <DialogDescription>{tt("dlg_add_desc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tt("f_name")} className="sm:col-span-2">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={tt("f_name_ph")}
                autoFocus
              />
            </Field>
            <Field label={tt("f_type")}>
              <Select
                value={form.contractorType}
                onValueChange={(v) => set("contractorType", v as ContractorType)}
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
            <Field label={tt("f_start_date")}>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label={tt("f_id_document")}>
              <Input
                value={form.idDocument}
                onChange={(e) => set("idDocument", e.target.value)}
                placeholder="8-123-4567"
              />
            </Field>
            <Field label={tt("f_phone")}>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="6000-0000" />
            </Field>
            <Field label={tt("f_contact")} hint={tt("f_contact_ph")} className="sm:col-span-2">
              <Input
                value={form.contactInfo}
                onChange={(e) => set("contactInfo", e.target.value)}
                placeholder={tt("f_optional")}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tt("saving") : tt("action_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
