"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { Contractor, ContractorType } from "@/types/contractors";
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
import { CountrySelect } from "@/components/shared/country-select";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createContractorAction, updateContractorAction } from "./actions";
import { Field } from "./field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";

/**
 * Alta y edición de un contratista (ebanista o pintor), con los mismos
 * datos personales que la ficha del empleado: documento, nacionalidad,
 * nacimiento, contacto de emergencia, contrato y cuenta bancaria. Las
 * etiquetas de esos campos son las de Planilla, así las dos fichas dicen lo
 * mismo. Inactivar / liquidar / borrar se hacen desde la ficha.
 */

const NONE = "__none__";

interface FormState {
  name: string;
  contractorType: ContractorType;
  startDate: string;
  phone: string;
  idDocumentType: "cedula" | "pasaporte" | typeof NONE;
  idDocument: string;
  nationality: string | null;
  birthDate: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  contractInfo: string;
  bankName: string;
  bankAccountType: "ahorro" | "corriente" | typeof NONE;
  bankRoutingCode: string;
  bankAccountNumber: string;
}

/** Datos con los que puede llegar prellenada el alta (ej. desde un registro de JotForm). */
export type ContractorPrefill = Partial<
  Pick<
    FormState,
    | "name"
    | "phone"
    | "email"
    | "address"
    | "birthDate"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "bankName"
    | "bankAccountType"
    | "bankAccountNumber"
    | "idDocument"
    | "idDocumentType"
    | "nationality"
  >
>;

function toForm(c?: Contractor): FormState {
  return {
    name: c?.name ?? "",
    contractorType: c?.contractorType ?? "ebanista",
    startDate: c?.startDate ?? "",
    phone: c?.phone ?? "",
    idDocumentType: c?.idDocumentType ?? NONE,
    idDocument: c?.idDocument ?? "",
    nationality: c?.nationality ?? null,
    birthDate: c?.birthDate ?? "",
    email: c?.email ?? "",
    address: c?.address ?? "",
    emergencyContactName: c?.emergencyContactName ?? "",
    emergencyContactPhone: c?.emergencyContactPhone ?? "",
    contractInfo: c?.contractInfo ?? "",
    bankName: c?.bankName ?? "",
    bankAccountType: c?.bankAccountType ?? NONE,
    bankRoutingCode: c?.bankRoutingCode ?? "",
    bankAccountNumber: c?.bankAccountNumber ?? "",
  };
}

export function ContractorFormDialog({
  contractor,
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  /** Con contratista = editar; sin = agregar uno nuevo. */
  contractor?: Contractor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solo al agregar: el formulario abre con estos datos ya puestos. */
  prefill?: ContractorPrefill;
  /** Solo al agregar: después de crear, con el id del contratista nuevo. */
  onCreated?: (contractorId: string) => void | Promise<void>;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const isEdit = Boolean(contractor);

  const [form, setForm] = React.useState<FormState>(() => (contractor ? toForm(contractor) : { ...toForm(), ...prefill }));
  const [submitting, setSubmitting] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"name">();
  const initial = React.useRef(JSON.stringify(form));
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => JSON.stringify(form) !== initial.current, () => onOpenChange(false));

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    const seed = contractor ? toForm(contractor) : { ...toForm(), ...prefill };
    setForm(seed);
    initial.current = JSON.stringify(seed);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open, contractor, prefill]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["name", !form.name.trim(), tt("f_name_required")]])) return;
    setSubmitting(true);
    const orNull = (v: string) => v.trim() || null;
    const data = {
      name: form.name.trim(),
      contractorType: form.contractorType,
      startDate: form.startDate || null,
      phone: orNull(form.phone),
      idDocumentType: form.idDocumentType === NONE ? null : form.idDocumentType,
      idDocument: orNull(form.idDocument),
      nationality: form.nationality,
      birthDate: form.birthDate || null,
      email: orNull(form.email),
      address: orNull(form.address),
      emergencyContactName: orNull(form.emergencyContactName),
      emergencyContactPhone: orNull(form.emergencyContactPhone),
      contractInfo: orNull(form.contractInfo),
      bankName: orNull(form.bankName),
      bankAccountType: form.bankAccountType === NONE ? null : form.bankAccountType,
      bankRoutingCode: orNull(form.bankRoutingCode),
      bankAccountNumber: orNull(form.bankAccountNumber),
    };
    try {
      if (contractor) {
        await updateContractorAction(contractor.id, data);
        toast.success(tt("action_save"));
      } else {
        const created = await createContractorAction(data);
        await onCreated?.(created.id);
        toast.success(tt("action_add"));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? tt("dlg_edit_title") : tt("dlg_add_title")}</DialogTitle>
          <DialogDescription>{isEdit ? tt("dlg_edit_desc") : tt("dlg_add_desc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <FormSection icon={ICON.client} title={tt("f_name")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tt("f_name")} required error={error("name")} className="sm:col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    clear("name");
                  }}
                  placeholder={tt("f_name_ph")}
                  autoFocus={!isEdit}
                />
              </Field>
              <Field label={tt("f_type")}>
                <Select value={form.contractorType} onValueChange={(v) => set("contractorType", v as ContractorType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ebanista">{tt("type_ebanista")}</SelectItem>
                    <SelectItem value="pintor">{tt("type_pintor")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("f_start_date")} icon={ICON.date}>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={ICON.phone} title={tp("sec_contact")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tp("f_phone")} icon={ICON.phone}>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="6000-0000" />
              </Field>
              <Field label={tp("f_email")} icon={ICON.email}>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label={tp("f_address")} icon={ICON.location} className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={tp("f_address_ph")} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={ICON.idDoc} title={tp("sec_identity")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tp("f_id_document_type")}>
                <Select value={form.idDocumentType} onValueChange={(v) => set("idDocumentType", v as FormState["idDocumentType"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="cedula">{tp("id_type_cedula")}</SelectItem>
                    <SelectItem value="pasaporte">{tp("id_type_pasaporte")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tp("f_id_document")}>
                <Input value={form.idDocument} onChange={(e) => set("idDocument", e.target.value)} placeholder="8-123-4567" />
              </Field>
              <Field label={tp("f_nationality")}>
                <CountrySelect value={form.nationality} onChange={(code) => set("nationality", code)} />
              </Field>
              <Field label={tp("f_birth_date")} icon={ICON.date}>
                <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
              </Field>
              <Field label={tp("f_contract")} className="sm:col-span-2">
                <Input value={form.contractInfo} onChange={(e) => set("contractInfo", e.target.value)} placeholder={tp("f_contract_ph")} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={ICON.emergency} title={tp("sec_emergency")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tp("f_emg_name")} icon={ICON.client}>
                <Input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
              </Field>
              <Field label={tp("f_emg_phone")} icon={ICON.phone}>
                <Input value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="6000-0000" />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={ICON.bank} title={tp("bank_section_title")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tp("f_bank_name")}>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
              </Field>
              <Field label={tp("f_bank_account_type")}>
                <Select value={form.bankAccountType} onValueChange={(v) => set("bankAccountType", v as FormState["bankAccountType"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="ahorro">{tp("bank_type_ahorro")}</SelectItem>
                    <SelectItem value="corriente">{tp("bank_type_corriente")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tp("f_bank_routing_code")}>
                <Input value={form.bankRoutingCode} onChange={(e) => set("bankRoutingCode", e.target.value)} />
              </Field>
              <Field label={tp("f_bank_account_number")}>
                <Input value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} />
              </Field>
            </div>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tt("saving") : isEdit ? tt("action_save") : tt("action_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
