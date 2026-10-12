"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import type { Contractor, ContractorHelper } from "@/types/contractors";
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
import {
  createContractorHelperAction,
  deleteContractorHelperAction,
  getContractorHelpersAction,
  updateContractorHelperAction,
} from "./actions";
import { Field } from "./field";

/**
 * Ayudantes de un contratista: lista + alta / edición / baja en el mismo
 * diálogo. Se carga al abrir y la lista vive en el estado local: cada cambio
 * se ve al instante y se guarda en segundo plano (si falla, avisa y vuelve a
 * leer lo guardado). Inputs controlados con `useState`, igual que el resto
 * de los diálogos del módulo.
 */

const NO_ACCOUNT_TYPE = "__none__";

interface FormState {
  name: string;
  idDocument: string;
  phone: string;
  bankName: string;
  bankAccountType: "ahorro" | "corriente" | typeof NO_ACCOUNT_TYPE;
  bankAccountNumber: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  idDocument: "",
  phone: "",
  bankName: "",
  bankAccountType: NO_ACCOUNT_TYPE,
  bankAccountNumber: "",
  notes: "",
};

function toForm(h: ContractorHelper): FormState {
  return {
    name: h.name,
    idDocument: h.idDocument ?? "",
    phone: h.phone ?? "",
    bankName: h.bankName ?? "",
    bankAccountType: h.bankAccountType ?? NO_ACCOUNT_TYPE,
    bankAccountNumber: h.bankAccountNumber ?? "",
    notes: h.notes ?? "",
  };
}

function toInput(f: FormState) {
  return {
    name: f.name.trim(),
    idDocument: f.idDocument.trim() || null,
    phone: f.phone.trim() || null,
    bankName: f.bankName.trim() || null,
    bankAccountType: f.bankAccountType === NO_ACCOUNT_TYPE ? null : f.bankAccountType,
    bankAccountNumber: f.bankAccountNumber.trim() || null,
    notes: f.notes.trim() || null,
  };
}

export function ContractorHelpersDialog({
  contractor,
  open,
  onOpenChange,
}: {
  contractor: Contractor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [helpers, setHelpers] = React.useState<ContractorHelper[] | null>(null);
  // `null` = sin formulario; "new" = alta; un id = editando ese ayudante.
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setHelpers(await getContractorHelpersAction(contractor.id));
    } catch (err) {
      console.error("Contratistas: no se pudieron cargar los ayudantes", err);
      toast.error(tt("helpers_load_error"));
      setHelpers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tt` cambia solo con el idioma.
  }, [contractor.id, lang]);

  /* eslint-disable react-hooks/set-state-in-effect -- carga al abrir; el diálogo se reusa entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setEditing(null);
    setError(null);
    setHelpers(null);
    load();
  }, [open, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  function startNew() {
    setForm(EMPTY);
    setError(null);
    setEditing("new");
  }

  function startEdit(h: ContractorHelper) {
    setForm(toForm(h));
    setError(null);
    setEditing(h.id);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(tt("f_name_required"));
      return;
    }
    const input = toInput(form);
    const target = editing;
    setEditing(null);

    if (target === "new") {
      // Alta: la fila aparece de inmediato con un id temporal y se cambia por
      // la real cuando el servidor responde.
      const tempId = `tmp-${Date.now()}`;
      setHelpers((prev) => [...(prev ?? []), { id: tempId, contractorId: contractor.id, ...input }]);
      createContractorHelperAction(contractor.id, input)
        .then((saved) => {
          setHelpers((prev) => (prev ?? []).map((h) => (h.id === tempId ? saved : h)));
          toast.success(tt("helpers_saved"));
        })
        .catch((err) => {
          console.error("Contratistas: no se pudo guardar el ayudante", err);
          toast.error(err instanceof Error ? err.message : "Error");
          load();
        });
      return;
    }

    if (target) {
      setHelpers((prev) => (prev ?? []).map((h) => (h.id === target ? { ...h, ...input } : h)));
      updateContractorHelperAction(target, input)
        .then(() => toast.success(tt("helpers_saved")))
        .catch((err) => {
          console.error("Contratistas: no se pudo guardar el ayudante", err);
          toast.error(err instanceof Error ? err.message : "Error");
          load();
        });
    }
  }

  function onDelete(h: ContractorHelper) {
    if (!window.confirm(`${tt("helpers_delete_confirm")}\n${h.name}`)) return;
    setHelpers((prev) => (prev ?? []).filter((x) => x.id !== h.id));
    deleteContractorHelperAction(h.id)
      .then(() => toast.success(tt("helpers_deleted")))
      .catch((err) => {
        console.error("Contratistas: no se pudo quitar el ayudante", err);
        toast.error(err instanceof Error ? err.message : "Error");
        load();
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tt("helpers_title")}</DialogTitle>
          <DialogDescription>
            {contractor.name} — {tt("helpers_desc")}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tt("f_name")} className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={tt("f_name_ph")} autoFocus />
              </Field>
              <Field label={tt("f_id_document")}>
                <Input value={form.idDocument} onChange={(e) => set("idDocument", e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("f_phone")}>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("f_bank_name")}>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder={tt("f_optional")} />
              </Field>
              <Field label={tt("f_bank_account_type")}>
                <Select value={form.bankAccountType} onValueChange={(v) => set("bankAccountType", v as FormState["bankAccountType"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT_TYPE}>{tt("f_optional")}</SelectItem>
                    <SelectItem value="ahorro">{tt("bank_type_ahorro")}</SelectItem>
                    <SelectItem value="corriente">{tt("bank_type_corriente")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("f_bank_account_number")} className="sm:col-span-2">
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => set("bankAccountNumber", e.target.value)}
                  placeholder={tt("f_optional")}
                />
              </Field>
              <Field label={tt("f_notes")} className="sm:col-span-2">
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {tt("action_cancel")}
              </Button>
              <Button type="submit">{tt("action_save")}</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {helpers === null ? (
              <p className="text-sm text-muted-foreground">{tt("loading")}</p>
            ) : helpers.length === 0 ? (
              <p className="rounded-none border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {tt("helpers_empty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {helpers.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 rounded-none border border-border px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[h.idDocument, h.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.bankName || h.bankAccountNumber
                          ? [
                              h.bankName,
                              h.bankAccountType ? tt(h.bankAccountType === "ahorro" ? "bank_type_ahorro" : "bank_type_corriente") : null,
                              h.bankAccountNumber,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : tt("helpers_no_bank")}
                      </p>
                      {h.notes && <p className="mt-0.5 text-xs text-muted-foreground">{h.notes}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label={tt("helpers_edit")}
                        title={tt("helpers_edit")}
                        disabled={h.id.startsWith("tmp-")}
                        onClick={() => startEdit(h)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={tt("helpers_delete")}
                        title={tt("helpers_delete")}
                        disabled={h.id.startsWith("tmp-")}
                        onClick={() => onDelete(h)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tt("action_close")}
              </Button>
              <Button type="button" onClick={startNew} disabled={helpers === null}>
                <Plus className="size-4" />
                {tt("helpers_add")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
