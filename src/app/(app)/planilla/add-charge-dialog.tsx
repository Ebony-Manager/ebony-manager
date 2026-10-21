"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Banknote, Car, ChevronDown, HandCoins, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";

import type { LoanCategory } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createLedgerEntryAction } from "../contratistas/actions";
import { FormDialog, Field } from "./form-dialog";
import { LoanDialog } from "./loan-dialog";

/** Alguien a quien se le puede registrar un préstamo o descuento. */
export interface ChargePerson {
  kind: "employee" | "contractor";
  id: string;
  name: string;
}

const TYPES: { value: LoanCategory; icon: LucideIcon; hint: keyof typeof strings.pagos }[] = [
  { value: "prestamo", icon: HandCoins, hint: "add_hint_prestamo" },
  { value: "adelanto", icon: Banknote, hint: "add_hint_adelanto" },
  { value: "herramienta", icon: Wrench, hint: "add_hint_herramienta" },
  { value: "dano", icon: TriangleAlert, hint: "add_hint_dano" },
  { value: "indrive", icon: Car, hint: "add_hint_indrive" },
];

const TYPE_LABEL: Record<LoanCategory, keyof typeof strings.planilla> = {
  prestamo: "loan_new_prestamo",
  adelanto: "loan_new_adelanto",
  herramienta: "loan_new_herramienta",
  dano: "loan_new_dano",
  indrive: "loan_new_indrive",
};

const toCents = (s: string) => {
  const v = Math.round(parseFloat(s || "0") * 100);
  return Number.isFinite(v) ? v : 0;
};

/**
 * "Agregar" de préstamos y descuentos: una sola ventana para préstamo,
 * adelanto, herramienta, daño e InDrive. Primero se elige el tipo y la
 * persona (o viene fija, desde su ficha); después, a un empleado se le abre
 * el formulario de cuotas (`LoanDialog`) y a un contratista uno corto que lo
 * anota en su estado de cuenta (sin cuotas).
 */
export function AddChargeDialog({
  open,
  onOpenChange,
  people,
  person: fixedPerson,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A quiénes se puede elegir (si no viene `person`). */
  people?: ChargePerson[];
  /** Persona fija (desde su ficha): no se pregunta a quién. */
  person?: ChargePerson;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const ts = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);

  const [type, setType] = React.useState<LoanCategory | null>(null);
  const [picked, setPicked] = React.useState<ChargePerson | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // El segundo paso: el formulario del tipo elegido, para esa persona.
  const [form, setForm] = React.useState<{ type: LoanCategory; person: ChargePerson } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reinicia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setType(null);
    setPicked(null);
    setError(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const person = fixedPerson ?? picked;
  const kindLabel = (p: ChargePerson) => ts(p.kind === "employee" ? "kind_employee" : "kind_contractor");

  function next() {
    if (!type || !person) {
      setError(tg("add_missing"));
      return;
    }
    setForm({ type, person });
    onOpenChange(false);
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={fixedPerson ? `${tg("add_title")} · ${fixedPerson.name}` : tg("add_title")}
        description={tg("add_desc")}
        onSubmit={next}
        submitLabel={tg("add_continue")}
        error={error}
        wide
      >
        <Field label={tg("add_type")}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TYPES.map(({ value, icon: Icon, hint }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setType(value);
                  setError(null);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  type === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", type === value ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{tp(TYPE_LABEL[value])}</span>
                  <span className="block text-xs text-muted-foreground">{tg(hint)}</span>
                </span>
              </button>
            ))}
          </div>
        </Field>

        {!fixedPerson && (
          <Field label={tg("add_person")}>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  {picked ? `${picked.name} · ${kindLabel(picked)}` : tg("add_pick_person")}
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={ts("search")} />
                  <CommandList>
                    <CommandEmpty>{ts("no_results")}</CommandEmpty>
                    {(people ?? []).map((p) => (
                      <CommandItem
                        key={`${p.kind}-${p.id}`}
                        value={`${p.name} ${p.kind}-${p.id}`}
                        onSelect={() => {
                          setPicked(p);
                          setPickerOpen(false);
                          setError(null);
                        }}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{kindLabel(p)}</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>
        )}
      </FormDialog>

      {form?.person.kind === "employee" && (
        <LoanDialog
          employeeId={form.person.id}
          categories={[form.type]}
          defaultCategory={form.type}
          open
          onOpenChange={(o) => !o && setForm(null)}
          onSaved={onSaved}
        />
      )}
      {form?.person.kind === "contractor" && (
        <ContractorChargeDialog
          type={form.type}
          person={form.person}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

/** Contratista: monto, fecha y detalle; se anota en su estado de cuenta como
 *  movimiento que reduce su saldo. */
function ContractorChargeDialog({
  type,
  person,
  onClose,
  onSaved,
}: {
  type: LoanCategory;
  person: ChargePerson;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    const amountCents = toCents(amount);
    if (amountCents <= 0) {
      setError(tg("cc_amount_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createLedgerEntryAction({
        contractorId: person.id,
        entryDate: date,
        category: type,
        direction: "reduce",
        amountCents,
        description: note.trim() || tp(TYPE_LABEL[type]),
      });
      toast.success(tg("cc_saved"));
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${tp(TYPE_LABEL[type])} · ${person.name}`}
      description={tg("cc_desc")}
      onSubmit={submit}
      submitting={submitting}
      submitLabel={tg("cc_save")}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={tg("cc_amount")}>
          <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <Field label={type === "indrive" ? tp("loan_f_ride_date") : tg("cc_date")}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={tg("cc_note")}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
