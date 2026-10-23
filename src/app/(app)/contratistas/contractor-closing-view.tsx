"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, HandCoins, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

import type { ContractorContract } from "@/types/contractors";
import type { ContractorClosingData } from "@/services/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCents, monthLabel, nextPeriod, previousPeriod } from "@/lib/planilla/payroll-period";
import { formatDate, formatDateCompact } from "@/lib/planilla/format";
import {
  contractPayableCents,
  contractSublabel,
  looseCredits,
  paymentPreview,
  sortContracts,
  unallocatedSources,
} from "@/lib/contractors/contracts";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { contractorProfilePath } from "@/lib/personal/paths";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { AddChargeDialog } from "@/app/(app)/planilla/add-charge-dialog";
import {
  closeContractorPayPeriodAction,
  getContractorClosingAction,
  reopenContractorPayPeriodAction,
  setContractorPayLineAction,
} from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";

type Half = 1 | 2;
interface PeriodSel {
  year: number;
  month: number;
  half: Half;
}

const LOOSE = "loose";
const lineKey = (contractorId: string, contractId: string | null) => `${contractorId}:${contractId ?? LOOSE}`;

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
const toInput = (cents: number) => (cents > 0 ? (cents / 100).toFixed(2) : "");

function currentQuincena(): PeriodSel {
  const [y, m, d] = todayInPanama().split("-").map(Number);
  return { year: y, month: m, half: d <= 15 ? 1 : 2 };
}

interface RowData {
  id: string;
  name: string;
  contracts: { contract: ContractorContract; pending: number }[];
  loosePending: number;
  onAccount: ReturnType<typeof unallocatedSources<ContractorClosingData["entries"][number]>>;
  onAccountCents: number;
  abonosCents: number;
  deductedCents: number;
  cashCents: number;
  over: boolean;
  paid: { abonosCents: number; deductedCents: number; cashCents: number } | null;
}

/**
 * Personal → Pagos → Contratistas → Cierre: la Quincena de los
 * contratistas. Por cada uno se pone cuánto se le abona a cada contrato
 * (borrador: no mueve nada); los descuentos con fecha hasta el día de pago
 * (cuotas, adelantos, descuentos a mano…) se restan solos y queda el neto a
 * entregar. "Lista" arma nombre + neto para la administradora; "Marcar
 * pagada" registra todos los pagos de una vez. Se puede reabrir.
 */
export function ContractorClosingView({
  loader = getContractorClosingAction,
}: {
  /** De dónde salen los datos (la vista previa de estilos pasa los suyos). */
  loader?: typeof getContractorClosingAction;
} = {}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [sel, setSel] = React.useState<PeriodSel>(currentQuincena);
  const [data, setData] = React.useState<ContractorClosingData | null>(null);
  const [inputs, setInputs] = React.useState<Record<string, string>>({});
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [chargeFor, setChargeFor] = React.useState<{ id: string; name: string } | null>(null);

  const load = React.useCallback(() => {
    loader(sel.year, sel.month, sel.half).then((d) => {
      setData(d);
      const next: Record<string, string> = {};
      for (const l of d.lines) next[lineKey(l.contractorId, l.contractId)] = toInput(l.amountCents);
      setInputs(next);
    });
  }, [sel, loader]);

  /* eslint-disable react-hooks/set-state-in-effect -- carga al cambiar de quincena. */
  React.useEffect(() => {
    setData(null);
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const paid = data?.period?.status === "paid";

  const rows = React.useMemo<RowData[]>(() => {
    if (!data) return [];
    const byContractor = <T extends { contractorId: string }>(list: T[], id: string) => list.filter((x) => x.contractorId === id);
    const out: RowData[] = [];
    for (const c of data.contractors) {
      const entries = byContractor(data.entries, c.id);
      const allocations = byContractor(data.allocations, c.id);
      const lineContracts = new Set(data.lines.filter((l) => l.contractorId === c.id).map((l) => l.contractId));
      const contracts = sortContracts(data.contracts.filter((k) => k.contractorId === c.id))
        .map((contract) => ({ contract, pending: contractPayableCents(contract) }))
        .filter(({ contract, pending }) => pending > 0 || lineContracts.has(contract.id));
      const loosePending = looseCredits(entries, allocations).reduce((s, r) => s + r.remainingCents, 0);
      const onAccount = unallocatedSources(entries, allocations, data.payDate);
      const onAccountCents = onAccount.reduce((s, r) => s + r.remainingCents, 0);
      const result = data.results.find((r) => r.contractorId === c.id) ?? null;
      const hasLines = lineContracts.size > 0;
      if (paid ? !result : c.status !== "ACTIVE" && !hasLines) continue;
      if (!paid && contracts.length === 0 && loosePending <= 0 && !hasLines) continue;

      const amount = (contractId: string | null) => toCents(inputs[lineKey(c.id, contractId)] ?? "");
      const abonosCents = contracts.reduce((s, x) => s + amount(x.contract.id), 0) + amount(null);
      const over = contracts.some((x) => amount(x.contract.id) > x.pending) || amount(null) > loosePending;
      const preview = paymentPreview(abonosCents, onAccountCents);
      out.push({
        id: c.id,
        name: c.name,
        contracts,
        loosePending,
        onAccount,
        onAccountCents,
        abonosCents,
        deductedCents: preview.deductedCents,
        cashCents: preview.cashCents,
        over,
        paid: result,
      });
    }
    return out;
  }, [data, inputs, paid]);

  const totals = rows.reduce(
    (s, r) => {
      const src = r.paid ?? r;
      return { abonos: s.abonos + src.abonosCents, deducted: s.deducted + src.deductedCents, cash: s.cash + src.cashCents };
    },
    { abonos: 0, deducted: 0, cash: 0 }
  );
  const anyOver = rows.some((r) => r.over);
  const toPay = rows.filter((r) => (r.paid?.cashCents ?? r.cashCents) > 0);

  async function saveLine(contractorId: string, contractId: string | null) {
    if (!data || paid) return;
    const key = lineKey(contractorId, contractId);
    const cents = toCents(inputs[key] ?? "");
    const prev = data.lines.find((l) => l.contractorId === contractorId && l.contractId === contractId)?.amountCents ?? 0;
    if (cents === prev) return;
    const res = await setContractorPayLineAction({ ...sel, contractorId, contractId, amountCents: cents });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            lines: [
              ...d.lines.filter((l) => !(l.contractorId === contractorId && l.contractId === contractId)),
              ...(cents > 0 ? [{ contractorId, contractId, amountCents: cents }] : []),
            ],
          }
        : d
    );
  }

  async function markPaid() {
    if (!data?.period) return;
    if (!window.confirm(tt("cl_confirm_paid"))) return;
    setBusy(true);
    const res = await closeContractorPayPeriodAction(data.period.id);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("cl_paid_done"));
    load();
    router.refresh();
  }

  async function reopen() {
    if (!data?.period) return;
    if (!window.confirm(tt("cl_confirm_reopen"))) return;
    setBusy(true);
    const res = await reopenContractorPayPeriodAction(data.period.id);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("cl_reopened"));
    load();
    router.refresh();
  }

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const periodLabel = `${sel.half === 1 ? tt("cl_half_1") : tt("cl_half_2")} ${monthLabel(lang, sel.month).toLowerCase()} ${sel.year}`;
  const hasLines = (data?.lines.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border px-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setSel((p) => previousPeriod(p.year, p.month, p.half))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-48 text-center text-sm font-medium text-foreground">{periodLabel}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setSel((p) => nextPeriod(p) as PeriodSel)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">
              {tt("cl_pay_date")}: {formatDate(lang, data.payDate)}
            </span>
          )}
          <Badge variant={paid ? "secondary" : "outline"}>{paid ? tt("cl_status_paid") : tt("cl_status_draft")}</Badge>
        </div>
      </div>

      {!data ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{tt("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {paid ? tt("cl_paid_empty") : tt("cl_empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{tt("ct_f_contractor")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("cl_col_pending")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("pay_sum_abonos")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("cl_col_deducted")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("cl_col_cash")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = open.has(r.id);
                const show = r.paid ?? r;
                const pendingTotal = r.contracts.reduce((s, x) => s + Math.max(0, x.pending), 0) + r.loosePending;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="cursor-pointer border-b border-border hover:bg-muted/40" onClick={() => toggle(r.id)}>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          {r.name}
                        </span>
                        {r.over && <span className="ml-5 block text-xs text-destructive">{tt("pay_err_over")}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(pendingTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatCents(show.abonosCents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {show.deductedCents > 0 ? `−${formatCents(show.deductedCents)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{formatCents(show.cashCents)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border bg-muted/20">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="flex flex-col gap-3 pl-5">
                            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
                              {r.contracts.map(({ contract: k, pending }) => (
                                <LineRow
                                  key={k.id}
                                  label={k.name}
                                  sublabel={contractSublabel(k, tt("ct_retained"))}
                                  pending={pending}
                                  value={inputs[lineKey(r.id, k.id)] ?? ""}
                                  disabled={paid}
                                  onChange={(v) => setInputs((cur) => ({ ...cur, [lineKey(r.id, k.id)]: v }))}
                                  onCommit={() => saveLine(r.id, k.id)}
                                  onFill={() => {
                                    setInputs((cur) => ({ ...cur, [lineKey(r.id, k.id)]: toInput(pending) }));
                                  }}
                                  fillLabel={tt("pay_fill")}
                                  pendingLabel={tt("ct_col_pending")}
                                />
                              ))}
                              {(r.loosePending > 0 || inputs[lineKey(r.id, null)]) && (
                                <LineRow
                                  label={tt("pay_loose")}
                                  sublabel={tt("pay_loose_hint")}
                                  pending={r.loosePending}
                                  value={inputs[lineKey(r.id, null)] ?? ""}
                                  disabled={paid}
                                  onChange={(v) => setInputs((cur) => ({ ...cur, [lineKey(r.id, null)]: v }))}
                                  onCommit={() => saveLine(r.id, null)}
                                  onFill={() => setInputs((cur) => ({ ...cur, [lineKey(r.id, null)]: toInput(r.loosePending) }))}
                                  fillLabel={tt("pay_fill")}
                                  pendingLabel={tt("ct_col_pending")}
                                />
                              )}
                              {r.contracts.length === 0 && r.loosePending <= 0 && (
                                <p className="px-3 py-2 text-xs text-muted-foreground">{tt("pay_nothing")}</p>
                              )}
                            </div>

                            {!paid && r.onAccount.length > 0 && (
                              <div className="flex flex-col gap-1">
                                <p className="text-xs font-medium text-foreground">{tt("pay_on_account")}</p>
                                <ul className="flex flex-col text-xs">
                                  {r.onAccount.map(({ entry, remainingCents }) => (
                                    <li key={entry.id} className="flex items-center gap-3 py-0.5">
                                      <span className="w-16 shrink-0 text-muted-foreground">{formatDateCompact(lang, entry.entryDate)}</span>
                                      <span className="shrink-0 text-foreground">
                                        {t(lang, strings.contratistas[CONTRACTOR_CATEGORY_LABEL_KEY[entry.category] as keyof typeof strings.contratistas])}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.description ?? ""}</span>
                                      <span className="shrink-0 tabular-nums text-foreground">{formatCents(remainingCents)}</span>
                                    </li>
                                  ))}
                                </ul>
                                {r.onAccountCents > r.abonosCents && r.abonosCents > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {tt("pay_left_on_account")} {formatCents(r.onAccountCents - r.deductedCents)}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {!paid && (
                                <Button size="sm" variant="outline" onClick={() => setChargeFor({ id: r.id, name: r.name })}>
                                  <HandCoins className="size-3.5" />
                                  {tt("ledger_add_charge")}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={contractorProfilePath(r.id)}>{tt("cl_open_profile")}</Link>
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border text-sm">
                <td className="px-3 py-2 font-medium text-foreground">{tt("cl_total")}</td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatCents(totals.abonos)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {totals.deducted > 0 ? `−${formatCents(totals.deducted)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-base font-semibold tabular-nums text-foreground">{formatCents(totals.cash)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setListOpen(true)} disabled={toPay.length === 0}>
            <ClipboardList className="size-3.5" />
            {tt("cl_list")}
          </Button>
          {paid ? (
            <Button variant="outline" size="sm" onClick={reopen} disabled={busy}>
              <RotateCcw className="size-3.5" />
              {tt("cl_reopen")}
            </Button>
          ) : (
            <Button size="sm" onClick={markPaid} disabled={busy || anyOver || !hasLines}>
              <CheckCircle2 className="size-3.5" />
              {tt("cl_mark_paid")}
            </Button>
          )}
        </div>
      )}

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-[min(95vw,28rem)]">
          <DialogHeader>
            <DialogTitle>{tt("cl_list_title")}</DialogTitle>
            <DialogDescription>{periodLabel}</DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <tbody>
              {toPay.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 text-foreground">{r.name}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums text-foreground">{formatCents(r.paid?.cashCents ?? r.cashCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="py-1.5 font-medium">{tt("cl_total")}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{formatCents(totals.cash)}</td>
              </tr>
            </tfoot>
          </table>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const text = [
                  periodLabel,
                  ...toPay.map((r) => `${r.name}\t${formatCents(r.paid?.cashCents ?? r.cashCents)}`),
                  `${tt("cl_total")}\t${formatCents(totals.cash)}`,
                ].join("\n");
                navigator.clipboard.writeText(text).then(() => toast.success(tt("cl_copied")));
              }}
            >
              {tt("cl_copy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {chargeFor && (
        <AddChargeDialog
          open
          onOpenChange={(o) => !o && setChargeFor(null)}
          person={{ kind: "contractor", id: chargeFor.id, name: chargeFor.name }}
          onSaved={load}
        />
      )}
    </div>
  );
}

function LineRow({
  label,
  sublabel,
  pending,
  value,
  disabled,
  onChange,
  onCommit,
  onFill,
  fillLabel,
  pendingLabel,
}: {
  label: string;
  sublabel?: string;
  pending: number;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
  onFill: () => void;
  fillLabel: string;
  pendingLabel: string;
}) {
  const over = Math.round(parseFloat(value || "0") * 100) > pending;
  // "Todo" llena y guarda: espera a que el valor llegue al input.
  const fillRef = React.useRef(false);
  React.useEffect(() => {
    if (fillRef.current) {
      fillRef.current = false;
      onCommit();
    }
  }, [value, onCommit]);
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{label}</p>
        {sublabel && <p className="truncate text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {pendingLabel}: {formatCents(pending)}
      </span>
      <div className="flex items-center gap-1">
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              fillRef.current = true;
              onFill();
            }}
          >
            {fillLabel}
          </Button>
        )}
        <Input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="0.00"
          className={`h-8 w-28 text-right ${over ? "border-destructive text-destructive" : ""}`}
        />
      </div>
    </div>
  );
}
