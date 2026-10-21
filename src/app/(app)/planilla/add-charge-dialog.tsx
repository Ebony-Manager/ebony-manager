"use client";

import * as React from "react";
import { Banknote, Car, ChevronDown, HandCoins, ReceiptText, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";

import type { LoanCategory } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
  { value: "otro", icon: ReceiptText, hint: "add_hint_otro" },
];

const TYPE_LABEL: Record<LoanCategory, keyof typeof strings.planilla> = {
  prestamo: "loan_new_prestamo",
  adelanto: "loan_new_adelanto",
  herramienta: "loan_new_herramienta",
  dano: "loan_new_dano",
  indrive: "loan_new_indrive",
  otro: "loan_new_otro",
};

/**
 * "Agregar" de préstamos y descuentos: una sola ventana para préstamo,
 * adelanto, herramienta, daño e InDrive. Primero se elige el tipo y la
 * persona (o viene fija, desde su ficha); después se abre el formulario de
 * cuotas (`LoanDialog`), igual para los dos: a un empleado las cuotas se le
 * descuentan en la planilla, a un contratista en su estado de cuenta.
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
            <Popover modal open={pickerOpen} onOpenChange={setPickerOpen}>
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

      {form && (
        <LoanDialog
          key={`${form.person.kind}-${form.person.id}-${form.type}`}
          {...(form.person.kind === "employee" ? { employeeId: form.person.id } : { contractorId: form.person.id })}
          categories={[form.type]}
          defaultCategory={form.type}
          open
          onOpenChange={(o) => !o && setForm(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
