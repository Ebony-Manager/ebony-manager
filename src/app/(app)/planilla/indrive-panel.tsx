"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import type { IndriveRide } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { formatCents, periodOrdinal } from "@/lib/planilla/payroll-period";
import { formatDate, monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  createIndriveRideAction,
  deleteIndriveRideAction,
  getIndriveRidesAction,
  setIndriveRideChargeAction,
} from "./actions";

/**
 * InDrive: los viajes de transporte del empleado. Cada viaje queda en el
 * historial; lo que decides es si se le cobra (se descuenta de la quincena del
 * viaje) o no. Todo se refleja al instante y se guarda en segundo plano.
 */
export function IndrivePanel({ employeeId, onChanged }: { employeeId: string; onChanged: () => void }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [rides, setRides] = React.useState<IndriveRide[] | null>(null);
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = React.useState(today);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [charge, setCharge] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [missingTable, setMissingTable] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await getIndriveRidesAction(employeeId);
      setMissingTable(res.missingTable);
      setRides(res.rides);
    } catch (err) {
      console.error("Planilla: no se pudieron cargar los viajes", err);
      toast.error(tt("load_failed"));
      setRides((prev) => prev ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tt` solo cambia con el idioma.
  }, [employeeId, lang]);

  /* eslint-disable react-hooks/set-state-in-effect -- carga al montar / al cambiar de empleado. */
  React.useEffect(() => {
    setRides(null);
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function fail(err: unknown) {
    console.error("Planilla: InDrive", err);
    toast.error(typeof err === "string" ? err : tt("load_failed"));
    void load();
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount || "0") * 100);
    if (!(amountCents > 0)) {
      setError(tt("indrive_amount_required"));
      return;
    }
    setError(null);
    const [y, m, d] = date.split("-").map(Number);
    const temp: IndriveRide = {
      id: `tmp-${Date.now()}`,
      employeeId,
      rideDate: date,
      amountCents,
      charge,
      notes: note.trim() || null,
      period: { year: y, month: m, half: d <= 15 ? 1 : 2 },
      locked: false,
    };
    setRides((prev) => [temp, ...(prev ?? [])]);
    setAmount("");
    setNote("");
    try {
      const res = await createIndriveRideAction({
        employeeId,
        rideDate: date,
        amountCents,
        charge,
        notes: temp.notes,
      });
      if (!res.ok) return fail(res.migrationPending ? tt("migration_pending") : res.error);
      await load();
      onChanged();
    } catch (err) {
      fail(err);
    }
  }

  async function setRideCharge(ids: string[], next: boolean) {
    setRides((prev) => (prev ?? []).map((r) => (ids.includes(r.id) ? { ...r, charge: next } : r)));
    try {
      for (const id of ids) {
        const res = await setIndriveRideChargeAction(id, next);
        if (!res.ok) return fail(res.error);
      }
      await load();
      onChanged();
    } catch (err) {
      fail(err);
    }
  }

  async function onDelete(r: IndriveRide) {
    if (!window.confirm(`${tt("indrive_delete_confirm")}\n${formatDate(lang, r.rideDate)} · ${formatCents(r.amountCents)}`)) return;
    setRides((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    try {
      await deleteIndriveRideAction(r.id);
      onChanged();
    } catch (err) {
      fail(err);
    }
  }

  // Agrupa por quincena (la más reciente arriba).
  const groups = React.useMemo(() => {
    const map = new Map<string, { period: IndriveRide["period"]; rides: IndriveRide[] }>();
    for (const r of rides ?? []) {
      const key = `${r.period.year}-${r.period.month}-${r.period.half}`;
      const g = map.get(key) ?? { period: r.period, rides: [] };
      g.rides.push(r);
      map.set(key, g);
    }
    return [...map.values()].sort(
      (a, b) =>
        periodOrdinal(b.period.year, b.period.month, b.period.half) -
        periodOrdinal(a.period.year, a.period.month, a.period.half)
    );
  }, [rides]);

  const now = new Date();
  const thisMonth = (rides ?? []).filter(
    (r) => r.period.year === now.getFullYear() && r.period.month === now.getMonth() + 1
  );
  const sum = (list: IndriveRide[]) => list.reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{tt("indrive_desc")}</p>
      {missingTable && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          {tt("migration_pending")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: `${tt("indrive_kpi_month")} · ${thisMonth.length} ${tt("indrive_rides")}`, value: sum(thisMonth) },
          { label: tt("indrive_kpi_charged"), value: sum(thisMonth.filter((r) => r.charge)) },
          { label: tt("indrive_kpi_free"), value: sum(thisMonth.filter((r) => !r.charge)) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border px-3 py-2">
            <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
            <p className="text-base font-semibold tabular-nums text-foreground">{formatCents(k.value)}</p>
          </div>
        ))}
      </div>

      <form onSubmit={onAdd} className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9rem_7rem_1fr]">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {tt("indrive_f_date")}
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {tt("indrive_f_amount")}
            <MoneyInput value={amount} onValueChange={setAmount} className="h-8" autoFocus />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[11px] text-muted-foreground sm:col-span-1">
            {tt("indrive_f_notes")}
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8" />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />
            {tt("indrive_f_charge")}
          </label>
          <Button type="submit" size="sm">
            <Plus className="size-3.5" />
            {tt("indrive_add")}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {rides === null ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{tt("loading")}</p>
      ) : groups.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{tt("indrive_empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const ids = g.rides.filter((r) => !r.locked && !r.id.startsWith("tmp-")).map((r) => r.id);
            const allCharged = g.rides.every((r) => r.charge);
            return (
              <section key={`${g.period.year}-${g.period.month}-${g.period.half}`} className="rounded-lg border border-border">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs">
                  <span className="font-medium text-foreground">
                    {monthShort(lang, g.period.month)} {g.period.year} · {g.period.half === 1 ? "1ra" : "2da"}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {g.rides.length} {tt("indrive_rides")} · {formatCents(sum(g.rides))}
                      {sum(g.rides.filter((r) => r.charge)) > 0 && (
                        <> · {tt("indrive_charged").toLowerCase()} {formatCents(sum(g.rides.filter((r) => r.charge)))}</>
                      )}
                    </span>
                  </span>
                  {ids.length > 0 && (
                    <button
                      type="button"
                      className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => setRideCharge(ids, !allCharged)}
                    >
                      {allCharged ? tt("indrive_uncharge_all") : tt("indrive_charge_all")}
                    </button>
                  )}
                </header>
                <ul className="divide-y divide-border">
                  {g.rides.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <span className="w-20 shrink-0 text-muted-foreground">{formatDate(lang, r.rideDate)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={r.notes ?? undefined}>
                        {r.notes ?? "—"}
                      </span>
                      <span className="w-16 shrink-0 text-right tabular-nums text-foreground">{formatCents(r.amountCents)}</span>
                      <label
                        className={`flex shrink-0 items-center gap-1.5 ${r.locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        title={r.locked ? tt("indrive_locked") : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={r.charge}
                          disabled={r.locked || r.id.startsWith("tmp-")}
                          onChange={(e) => setRideCharge([r.id], e.target.checked)}
                        />
                        <span className={r.charge ? "text-foreground" : "text-muted-foreground"}>
                          {r.charge ? tt("indrive_charged") : tt("indrive_not_charged")}
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                        title={tt("mov_delete_title")}
                        disabled={r.locked || r.id.startsWith("tmp-")}
                        onClick={() => onDelete(r)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
