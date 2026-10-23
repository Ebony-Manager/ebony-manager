"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Cake, FileImage, Hammer, IdCard, Inbox, Landmark, Link2, LifeBuoy, Mail, MapPin, Phone, Users, X } from "lucide-react";

import type { PayrollPosition } from "@/types/planilla";
import type { StaffIntake } from "@/types/staff-intake";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { formatDate } from "@/lib/planilla/format";
import { countryName } from "@/lib/countries";
import { findStaffMatch, type MatchCandidate } from "@/lib/personal/jotform-intake";
import { EmployeeFormDialog, type EmployeePrefill } from "../../planilla/employee-form-dialog";
import { ContractorFormDialog, type ContractorPrefill } from "../../contratistas/contractor-form-dialog";
import { dismissIntakeAction, linkIntakeAction, markIntakeCreatedAction, type IntakeResult } from "./actions";

/**
 * "Nuevos registros": lo que llegó del formulario de JotForm y falta
 * revisar. Cada registro se crea como empleado o contratista (el formulario
 * de alta abre con todo ya puesto; falta lo que el formulario de JotForm no
 * pide, como puesto y sueldo), se vincula a alguien que ya está (se llena
 * solo lo vacío de su ficha) o se descarta.
 */
export function IntakeInbox({
  intakes,
  candidates,
  positions,
  canEmployees,
  canContractors,
}: {
  intakes: StaffIntake[];
  /** Todo el staff que ve el usuario, para avisar "ya está" y vincular. */
  candidates: MatchCandidate[];
  positions: PayrollPosition[];
  canEmployees: boolean;
  canContractors: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const router = useRouter();
  const [creating, setCreating] = React.useState<{ intake: StaffIntake; kind: "employee" | "contractor" } | null>(null);

  // Memo por registro: los diálogos re-siembran el formulario cuando cambia `prefill`.
  const employeePrefill = React.useMemo<EmployeePrefill | undefined>(() => {
    const i = creating?.intake;
    if (!i) return undefined;
    return {
      name: [i.firstName, i.lastName].filter(Boolean).join(" "),
      phone: i.phone ?? "",
      email: i.email ?? "",
      address: i.address ?? "",
      birthDate: i.birthDate ?? "",
      emergencyContactName: i.emergencyContactName ?? "",
      emergencyContactPhone: i.emergencyContactPhone ?? "",
      bankName: i.bankName ?? "",
      bankAccountNumber: i.bankAccountNumber ?? "",
      ...(i.bankAccountType ? { bankAccountType: i.bankAccountType } : {}),
      idDocument: i.idNumber ?? "",
      ...(i.idDocumentType ? { idDocumentType: i.idDocumentType } : {}),
      ...(i.nationality ? { nationality: i.nationality } : {}),
    };
  }, [creating]);
  // Mismos campos; el enlace al documento lo agrega a las notas markIntakeCreatedAction.
  const contractorPrefill: ContractorPrefill | undefined = employeePrefill;

  async function afterCreate(kind: "employee" | "contractor", personId: string) {
    if (!creating) return;
    const res = await markIntakeCreatedAction(creating.intake.id, kind, personId);
    if (!res.ok) toast.error(res.error);
    else if (res.documentCopied === false) toast(tt("intake_doc_not_copied"), { duration: 8000 });
    router.refresh();
  }

  if (intakes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Inbox className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {tt("intake_title")} ({intakes.length})
        </h2>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{tt("intake_hint")}</p>

      <ul className="flex flex-col gap-3">
        {intakes.map((intake) => (
          <IntakeCard
            key={intake.id}
            intake={intake}
            candidates={candidates}
            canEmployees={canEmployees}
            canContractors={canContractors}
            onCreate={(kind) => setCreating({ intake, kind })}
          />
        ))}
      </ul>

      {canEmployees && (
        <EmployeeFormDialog
          mode="add"
          positions={positions}
          open={creating?.kind === "employee"}
          onOpenChange={(o) => !o && setCreating(null)}
          prefill={employeePrefill}
          onCreated={(id) => afterCreate("employee", id)}
        />
      )}
      {canContractors && (
        <ContractorFormDialog
          open={creating?.kind === "contractor"}
          onOpenChange={(o) => !o && setCreating(null)}
          prefill={contractorPrefill}
          onCreated={(id) => afterCreate("contractor", id)}
        />
      )}
    </section>
  );
}

function IntakeCard({
  intake,
  candidates,
  canEmployees,
  canContractors,
  onCreate,
}: {
  intake: StaffIntake;
  candidates: MatchCandidate[];
  canEmployees: boolean;
  canContractors: boolean;
  onCreate: (kind: "employee" | "contractor") => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirmDismiss, setConfirmDismiss] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const name = [intake.firstName, intake.lastName].filter(Boolean).join(" ") || intake.email || "—";
  const match = findStaffMatch(intake, candidates);
  const kindLabel = (k: MatchCandidate["kind"]) => tt(k === "employee" ? "kind_employee" : "kind_contractor");
  const canLink = (k: MatchCandidate["kind"]) => (k === "employee" ? canEmployees : canContractors);

  async function run(action: () => Promise<IntakeResult>, done: string) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(done);
    if (res.documentCopied === false) toast(tt("intake_doc_not_copied"), { duration: 8000 });
    router.refresh();
  }

  const link = (p: MatchCandidate) => {
    setPickerOpen(false);
    void run(() => linkIntakeAction(intake.id, p.kind, p.id), `${tt("intake_linked")} ${p.name}`);
  };

  const bank = [intake.bankName, intake.bankAccountNumber].filter(Boolean).join(" · ");
  const emergency = [intake.emergencyContactName, intake.emergencyContactPhone].filter(Boolean).join(" · ");
  const details: { icon: typeof Mail; text: string | null }[] = [
    { icon: Mail, text: intake.email },
    { icon: Phone, text: intake.phone },
    { icon: Cake, text: intake.birthDate ? formatDate(lang, intake.birthDate) : null },
    { icon: IdCard, text: [intake.idNumber, countryName(intake.nationality, lang)].filter(Boolean).join(" · ") || null },
    { icon: MapPin, text: intake.address },
    { icon: Landmark, text: bank || null },
    {
      icon: LifeBuoy,
      text: emergency ? `${emergency}${intake.emergencyContactRelation ? ` (${intake.emergencyContactRelation})` : ""}` : null,
    },
  ];

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">
            {tt("intake_received")} {formatDate(lang, intake.receivedAt.slice(0, 10))}
          </div>
        </div>
        {intake.idDocumentUrl && (
          <a
            href={intake.idDocumentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <FileImage className="size-3.5" />
            {tt("intake_document")}
          </a>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-foreground sm:grid-cols-2">
        {details
          .filter((d) => d.text)
          .map(({ icon: Icon, text }) => (
            <li key={text} className="flex min-w-0 items-start gap-1.5">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          ))}
      </ul>

      {match && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs">
          <span className="text-foreground">
            {tt("intake_match")} <strong>{match.name}</strong> ({kindLabel(match.kind)})
          </span>
          {canLink(match.kind) && (
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" disabled={busy} onClick={() => link(match)}>
              <Link2 className="size-3.5" />
              {tt("intake_link_match")}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEmployees && (
          <Button size="sm" disabled={busy} onClick={() => onCreate("employee")}>
            <Users className="size-3.5" />
            {tt("intake_create_employee")}
          </Button>
        )}
        {canContractors && (
          <Button size="sm" variant={canEmployees ? "outline" : "default"} disabled={busy} onClick={() => onCreate("contractor")}>
            <Hammer className="size-3.5" />
            {tt("intake_create_contractor")}
          </Button>
        )}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" disabled={busy}>
              <Link2 className="size-3.5" />
              {tt("intake_link_other")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder={tt("search")} />
              <CommandList>
                <CommandEmpty>{tt("no_results")}</CommandEmpty>
                {candidates
                  .filter((p) => canLink(p.kind))
                  .map((p) => (
                    <CommandItem key={`${p.kind}-${p.id}`} value={`${p.name} ${p.kind}-${p.id}`} onSelect={() => link(p)}>
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{kindLabel(p.kind)}</span>
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="ml-auto">
          {confirmDismiss ? (
            <span className="flex items-center gap-1.5 text-xs">
              {tt("intake_dismiss_confirm")}
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                disabled={busy}
                onClick={() => run(() => dismissIntakeAction(intake.id), tt("intake_dismissed"))}
              >
                {tt("intake_dismiss")}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDismiss(false)}>
                <X className="size-3.5" />
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={() => setConfirmDismiss(true)}>
              {tt("intake_dismiss")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
