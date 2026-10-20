"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Banknote, ChevronDown, X } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
import type { MoneyRequest } from "@/types/money-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { formatDate } from "@/lib/planilla/format";
import { formatCents } from "@/lib/planilla/payroll-period";
import { findStaffMatch, type MatchCandidate } from "@/lib/personal/jotform-intake";
import { LOAN_SURCHARGE_PCT } from "@/lib/personal/jotform-money";
import { LoanDialog, type LoanPrefill } from "./loan-dialog";
import {
  dismissMoneyRequestAction,
  markMoneyRequestRegisteredAction,
  registerContractorMoneyRequestAction,
  type MoneyRequestResult,
} from "./money-request-actions";

/**
 * "Solicitudes de dinero": adelantos y préstamos que llegaron ya aprobados
 * del workflow de JotForm. Cada una se registra —a un empleado, con el
 * formulario de préstamo ya lleno para elegir cuotas y quincena; a un
 * contratista, como movimiento en su estado de cuenta— o se descarta.
 */
export function MoneyRequestInbox({
  requests,
  employees,
  contractors,
  canContractors,
  onChanged,
}: {
  requests: MoneyRequest[];
  employees: PayrollEmployee[];
  /** Vacío si el usuario no tiene el módulo Contratistas. */
  contractors: Contractor[];
  canContractors: boolean;
  /** Para que la vista de préstamos de abajo se recargue. */
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();
  const [registering, setRegistering] = React.useState<{ request: MoneyRequest; employeeId: string } | null>(null);

  const candidates = React.useMemo<MatchCandidate[]>(
    () => [
      ...employees
        .filter((e) => e.status === "ACTIVE")
        .map((e) => ({ kind: "employee" as const, id: e.id, name: e.name, email: e.email, phone: e.phone })),
      ...contractors
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({ kind: "contractor" as const, id: c.id, name: c.name, email: c.email, phone: c.phone })),
    ],
    [employees, contractors]
  );

  const prefill = React.useMemo<LoanPrefill | undefined>(() => {
    const r = registering?.request;
    if (!r?.type || !r.amountCents) return undefined;
    return {
      category: r.type,
      amountCents: r.amountCents,
      requestDate: r.receivedAt.slice(0, 10),
      interestTotalPct: r.type === "prestamo" ? LOAN_SURCHARGE_PCT : undefined,
      notes: tt("mr_loan_note"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tt depende solo de lang.
  }, [registering, lang]);

  async function afterLoanSaved() {
    if (!registering) return;
    const res = await markMoneyRequestRegisteredAction(registering.request.id, registering.employeeId);
    if (!res.ok) toast.error(res.error);
    setRegistering(null);
    onChanged();
    router.refresh();
  }

  if (requests.length === 0) return null;

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Banknote className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {tt("mr_title")} ({requests.length})
        </h2>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{tt("mr_hint")}</p>

      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            candidates={candidates}
            canContractors={canContractors}
            onRegisterEmployee={(employeeId) => setRegistering({ request: r, employeeId })}
            onDone={() => {
              onChanged();
              router.refresh();
            }}
          />
        ))}
      </ul>

      {registering && (
        <LoanDialog
          employeeId={registering.employeeId}
          categories={["prestamo", "adelanto"]}
          defaultCategory={registering.request.type ?? "adelanto"}
          open
          onOpenChange={(o) => !o && setRegistering(null)}
          onSaved={() => void afterLoanSaved()}
          prefill={prefill}
        />
      )}
    </section>
  );
}

function RequestCard({
  request,
  candidates,
  canContractors,
  onRegisterEmployee,
  onDone,
}: {
  request: MoneyRequest;
  candidates: MatchCandidate[];
  canContractors: boolean;
  onRegisterEmployee: (employeeId: string) => void;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const ts = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const [person, setPerson] = React.useState<MatchCandidate | null>(() => findStaffMatch({ ...request, phone: null }, candidates));
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"contractor" | "dismiss" | null>(null);
  const [busy, setBusy] = React.useState(false);

  const name = [request.firstName, request.lastName].filter(Boolean).join(" ") || request.email || "—";
  const typeLabel = request.type === "prestamo" ? tt("loan_type_prestamo") : request.type === "adelanto" ? tt("loan_type_adelanto") : "—";
  const canRegister = Boolean(request.type && request.amountCents && person && (person.kind === "employee" || canContractors));

  async function run(action: () => Promise<MoneyRequestResult>, done: string) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(done);
    onDone();
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            <Badge variant={request.type === "prestamo" ? "default" : "secondary"}>{typeLabel}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {tt("mr_received")} {formatDate(lang, request.receivedAt.slice(0, 10))}
            {request.email ? ` · ${request.email}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {request.amountCents !== null ? formatCents(request.amountCents) : "—"}
          </div>
          {request.deductCents !== null && request.deductCents !== request.amountCents && (
            <div className="text-xs text-muted-foreground">
              {tt("mr_deduct")} {formatCents(request.deductCents)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{tt("mr_for")}</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy}>
              {person ? `${person.name} · ${ts(person.kind === "employee" ? "kind_employee" : "kind_contractor")}` : tt("mr_pick_person")}
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder={ts("search")} />
              <CommandList>
                <CommandEmpty>{ts("no_results")}</CommandEmpty>
                {candidates.map((p) => (
                  <CommandItem
                    key={`${p.kind}-${p.id}`}
                    value={`${p.name} ${p.kind}-${p.id}`}
                    onSelect={() => {
                      setPerson(p);
                      setPickerOpen(false);
                      setConfirm(null);
                    }}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {ts(p.kind === "employee" ? "kind_employee" : "kind_contractor")}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {confirm === "contractor" && person && request.deductCents !== null ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs">
          <span className="text-foreground">
            {tt("mr_contractor_confirm")} <strong>{formatCents(request.deductCents)}</strong> ({typeLabel}) · {person.name}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => run(() => registerContractorMoneyRequestAction(request.id, person.id), tt("mr_registered"))}
            >
              {tt("mr_register")}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirm(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={busy || !canRegister}
            onClick={() => {
              if (!person) return;
              if (person.kind === "employee") onRegisterEmployee(person.id);
              else setConfirm("contractor");
            }}
          >
            <Banknote className="size-3.5" />
            {person?.kind === "contractor" ? tt("mr_register_contractor") : tt("mr_register_employee")}
          </Button>
          <div className="ml-auto">
            {confirm === "dismiss" ? (
              <span className="flex items-center gap-1.5 text-xs">
                {tt("mr_dismiss_confirm")}
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => run(() => dismissMoneyRequestAction(request.id), tt("mr_dismissed"))}
                >
                  {tt("mr_dismiss")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirm(null)}>
                  <X className="size-3.5" />
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={() => setConfirm("dismiss")}>
                {tt("mr_dismiss")}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
