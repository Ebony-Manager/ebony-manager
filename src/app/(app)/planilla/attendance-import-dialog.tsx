"use client";

import * as React from "react";
import { ChevronDown, ClipboardCopy, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import type { getRegistroAction } from "./actions";
import type { DayFlag, RawPunch } from "@/lib/attendance/types";
import type { StoredResolution } from "@/services/attendance";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildProposal, periodDateRange, type OvertimeAuthorization, type ProposalEmployee } from "@/lib/attendance/proposal";
import { dailyRateCents, hourlyRateCents, quantityToCents } from "@/lib/planilla/payroll-rates";
import { monthLabel, type Period } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { clearPeriodHoursAction, upsertPayrollEntryAction } from "./actions";
import { useConfirm } from "@/components/shared/confirm-dialog";

type RegistroRow = Awaited<ReturnType<typeof getRegistroAction>>[number];

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const parseHM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const FLAG_KEY: Record<DayFlag, keyof typeof strings.planilla> = {
  absent: "att_flag_absent",
  missing_out: "att_flag_missing_out",
  missing_in: "att_flag_missing_in",
  unclear: "att_flag_unclear",
  early_leave: "att_flag_early",
  sunday_punch: "att_flag_sunday",
};

interface Edit {
  horas: string;
  dias: string;
  extras: string;
}

/**
 * Pasar la asistencia a la Quincena: con las ponchadas guardadas de la quincena
 * (reloj y Jotform, ver Pagos → Asistencia) se muestra qué se sugiere escribir en
 * "Horas descontadas", "Días descontados" y "Horas extra" y, al lado, lo que hay
 * hoy en la app, antes de aplicar nada. Las horas extra solo salen de los
 * formularios firmados por la jefa de taller: se anotan acá (empleado, fecha, de
 * qué hora a qué hora).
 */
export function AttendanceImportDialog({
  open,
  onOpenChange,
  period,
  rows,
  punches,
  links,
  resolutions,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  rows: RegistroRow[];
  /** Ponchadas guardadas de la quincena. */
  punches: RawPunch[];
  /** Vínculos nombre → empleado (ver `matchEmployees`). */
  links: ReadonlyMap<string, string | null>;
  /** Días revisados a mano. */
  resolutions: StoredResolution[];
  onApplied: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const range = React.useMemo(() => periodDateRange(period.year, period.month, period.half), [period]);

  const [overtime, setOvertime] = React.useState<OvertimeAuthorization[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [edits, setEdits] = React.useState<Record<string, Edit>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [applying, setApplying] = React.useState(false);
  const { confirm, dialog } = useConfirm();
  const [otEmployee, setOtEmployee] = React.useState("");
  const [otDate, setOtDate] = React.useState("");
  const [otFrom, setOtFrom] = React.useState("17:00");
  const [otTo, setOtTo] = React.useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir o cambiar de quincena. */
  React.useEffect(() => {
    if (!open) return;
    setOvertime([]);
    setExpanded(new Set());
    setOtDate(range.from);
  }, [open, range.from]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const employees: ProposalEmployee[] = React.useMemo(
    () =>
      rows.map((r) => ({
        id: r.employee.id,
        name: r.employee.name,
        status: r.employee.status,
        categoria: r.employee.categoria,
        startDate: r.employee.startDate,
        endDate: r.employee.endDate,
        monthlySalaryCents: r.monthlySalaryCents,
      })),
    [rows]
  );
  const rowById = React.useMemo(() => new Map(rows.map((r) => [r.employee.id, r])), [rows]);

  const { proposals, unmatched } = React.useMemo(
    () => buildProposal({ from: range.from, to: range.to, punches, employees, overtime, links, resolutions, today: todayInPanama() }),
    [range, punches, employees, overtime, links, resolutions]
  );

  // Cada vez que cambia la propuesta se re-siembran los campos editables y se marcan todos.
  const proposalKey = proposals.map((p) => `${p.employeeId}:${p.suggested.horasDescontadas}:${p.suggested.diasDescontados}:${p.suggested.extraHours}:${p.blockingDays}`).join("|");
  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al cambiar la propuesta. */
  React.useEffect(() => {
    setEdits(
      Object.fromEntries(
        proposals.map((p) => [
          p.employeeId,
          { horas: String(p.suggested.horasDescontadas), dias: String(p.suggested.diasDescontados), extras: String(p.suggested.extraHours) },
        ])
      )
    );
    // Quien tiene días sin revisar no se puede aplicar.
    setSelected(new Set(proposals.filter((p) => p.blockingDays === 0).map((p) => p.employeeId)));
    // También al volver a abrir: antes se vaciaba al abrir y, con la misma propuesta, no se volvía a llenar.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depende de la clave resumida.
  }, [proposalKey, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function addOvertime() {
    const from = parseHM(otFrom);
    const to = parseHM(otTo);
    if (!otEmployee || !otDate || from === null || to === null || to <= from) {
      toast.error(tt("att_ot_invalid"));
      return;
    }
    setOvertime((prev) => [...prev, { employeeId: otEmployee, date: otDate, fromMinutes: from, toMinutes: to }]);
    setOtTo("");
  }

  function reviewText(): string {
    const lines: string[] = [];
    for (const p of proposals) {
      const days = p.review.filter((r) => !r.flags.includes("early_leave") || r.flags.length > 1);
      if (days.length === 0) continue;
      lines.push(`${p.name}: ${days.map((d) => `${d.date.slice(8)} (${d.flags.filter((f) => f !== "early_leave").map((f) => tt(FLAG_KEY[f])).join(", ")})`).join(" · ")}`);
    }
    return lines.join("\n");
  }

  async function copyReview() {
    try {
      await navigator.clipboard.writeText(reviewText());
      toast.success(tt("att_copied"));
    } catch {
      toast.error(tt("att_file_error"));
    }
  }

  async function clearHours() {
    if (!(await confirm({ title: `${tt("att_clear")} · ${quincenaLabel}`, message: tt("att_clear_confirm"), confirmLabel: tt("att_clear"), destructive: true }))) return;
    setApplying(true);
    try {
      const { cleared } = await clearPeriodHoursAction(period.year, period.month, period.half);
      toast.success(`${tt("att_cleared")}: ${cleared}`);
      onApplied();
    } catch (err) {
      console.error("Asistencia: no se pudo limpiar", err);
      toast.error(tt("att_apply_error"));
    } finally {
      setApplying(false);
    }
  }

  async function apply() {
    setApplying(true);
    let ok = 0;
    const failed: string[] = [];
    try {
      for (const p of proposals) {
        if (!selected.has(p.employeeId) || p.blockingDays > 0) continue;
        const row = rowById.get(p.employeeId);
        if (!row) continue;
        const e = edits[p.employeeId] ?? {
          horas: String(p.suggested.horasDescontadas),
          dias: String(p.suggested.diasDescontados),
          extras: String(p.suggested.extraHours),
        };
        const num = (s: string) => {
          const n = parseFloat(s || "0");
          return Number.isFinite(n) ? n : 0;
        };
        const horas = num(e.horas);
        const dias = num(e.dias);
        const extras = num(e.extras);
        const hourly = hourlyRateCents({ baseSalaryCents: row.monthlySalaryCents });
        const daily = dailyRateCents({ baseSalaryCents: row.monthlySalaryCents });
        // Uno que falle no frena a los demás: al final se dice quién no se aplicó.
        try {
        await upsertPayrollEntryAction({
          employeeId: p.employeeId,
          periodYear: period.year,
          periodMonth: period.month,
          periodHalf: period.half,
          horasDescontadas: horas,
          horasDescontadasCents: quantityToCents(horas, hourly),
          diasDescontados: dias,
          diasDescontadosCents: quantityToCents(dias, daily),
          // Las horas extra solo se tocan si hay formularios.
          ...(p.overtimeMinutes > 0 ? { extraHours: extras, extraHoursCents: quantityToCents(extras, hourly) } : {}),
        });
        ok += 1;
        } catch (err) {
          console.error("Asistencia: no se pudo aplicar a", p.name, err);
          failed.push(`${p.name}${err instanceof Error && err.message ? ` (${err.message})` : ""}`);
        }
      }
      if (ok) toast.success(`${tt("att_applied")}: ${ok}`);
      if (failed.length) {
        toast.error(`${tt("att_apply_failed_for")}: ${failed.join(", ")}`, { duration: 10000 });
        onApplied();
        return;
      }
      onApplied();
      onOpenChange(false);
    } catch (err) {
      console.error("Asistencia: no se pudo aplicar", err);
      toast.error(tt("att_apply_error"));
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  const hasFiles = punches.length > 0;
  const eligible = proposals.filter((p) => p.blockingDays === 0 && rowById.has(p.employeeId)).map((p) => p.employeeId);
  const th = "px-2 py-2 font-medium whitespace-nowrap";
  const diffClass = (a: string, current: number) => (Math.abs((parseFloat(a || "0") || 0) - current) > 0.004 ? "bg-amber-50 dark:bg-amber-950/30" : "");
  const quincenaLabel = `${period.half === 1 ? "1Q" : "2Q"} ${monthLabel(lang, period.month)} ${period.year}`;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tt("att_title")} · {quincenaLabel}
          </DialogTitle>
          <DialogDescription>{tt("att_desc")}</DialogDescription>
        </DialogHeader>

        <details className="rounded-lg overflow-hidden border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
            {tt("att_ot_title")} ({overtime.length})
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-3">
            <p className="text-xs text-muted-foreground">{tt("att_ot_hint")}</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_9rem_6rem_6rem_auto]">
              <Select value={otEmployee} onValueChange={setOtEmployee}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder={tt("att_ot_employee")} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {employees
                    .filter((e) => e.status === "ACTIVE")
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input type="date" value={otDate} min={range.from} max={range.to} onChange={(e) => setOtDate(e.target.value)} className="h-8" />
              <Input value={otFrom} onChange={(e) => setOtFrom(e.target.value)} placeholder="17:00" className="h-8" aria-label={tt("att_ot_from")} />
              <Input value={otTo} onChange={(e) => setOtTo(e.target.value)} placeholder="18:14" className="h-8" aria-label={tt("att_ot_to")} />
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={addOvertime}>
                <Plus className="size-3.5" />
                {tt("att_ot_add")}
              </Button>
            </div>
            {overtime.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs">
                {overtime.map((o, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border-b border-border/60 py-1 last:border-0">
                    <span className="text-foreground">
                      {employees.find((e) => e.id === o.employeeId)?.name} · {formatDate(lang, o.date)} · {hm(o.fromMinutes)}–{hm(o.toMinutes)}{" "}
                      <span className="text-muted-foreground">({hm(o.toMinutes - o.fromMinutes)})</span>
                    </span>
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setOvertime((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        {!hasFiles && overtime.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tt("att_empty")}</p>
        ) : (
          <>
            {unmatched.length > 0 && (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {tt("att_unmatched")}: <span className="font-medium text-foreground">{unmatched.join(", ")}</span>
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className={th}>
                      {/* Todos / ninguno (los que tienen días sin revisar no se pueden marcar). */}
                      <input
                        type="checkbox"
                        aria-label={tt("att_select_all")}
                        title={tt("att_select_all")}
                        disabled={eligible.length === 0}
                        checked={eligible.length > 0 && eligible.every((id) => selected.has(id))}
                        ref={(el) => {
                          if (el) el.indeterminate = selected.size > 0 && !eligible.every((id) => selected.has(id));
                        }}
                        onChange={(ev) => setSelected(ev.target.checked ? new Set(eligible) : new Set())}
                      />
                    </th>
                    <th className={th}>{tt("col_empleado")}</th>
                    <th className={`${th} text-right`}>{tg("att_col_late_early")}</th>
                    <th className={`${th} text-right`}>{tt("att_col_absent")}</th>
                    <th className={`${th} text-right`}>{tt("att_col_review")}</th>
                    <th className={`${th} text-right`}>{tt("col_horas_desc")}</th>
                    <th className={`${th} text-right`}>{tt("att_col_now")}</th>
                    <th className={`${th} text-right`}>{tt("col_dias_desc")}</th>
                    <th className={`${th} text-right`}>{tt("att_col_now")}</th>
                    <th className={`${th} text-right`}>{tt("col_extra_hours")}</th>
                    <th className={`${th} text-right`}>{tt("att_col_now")}</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const entry = rowById.get(p.employeeId)?.total.entry;
                    const e = edits[p.employeeId] ?? { horas: "", dias: "", extras: "" };
                    const isOpen = expanded.has(p.employeeId);
                    return (
                      <React.Fragment key={p.employeeId}>
                        <tr className="border-b border-border">
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              disabled={p.blockingDays > 0}
                              title={p.blockingDays > 0 ? tg("att_blocked_hint") : undefined}
                              checked={selected.has(p.employeeId)}
                              onChange={(ev) =>
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (ev.target.checked) next.add(p.employeeId);
                                  else next.delete(p.employeeId);
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap font-medium text-foreground">
                            {p.name}
                            {p.blockingDays > 0 && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                {p.blockingDays} {tg("att_blocked_days")}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{hm(p.lateMinutes + p.earlyLeaveMinutes)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {p.absentWeekdays}
                            {p.absentSaturdays > 0 && <span className="text-xs text-muted-foreground"> +{p.absentSaturdays} {tt("att_sat")}</span>}
                            {p.notEmployedDays > 0 && (
                              <span className="block text-[11px] text-muted-foreground">
                                +{p.notEmployedDays} {tg("att_not_employed")}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {p.review.length > 0 ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(p.employeeId)) next.delete(p.employeeId);
                                    else next.add(p.employeeId);
                                    return next;
                                  })
                                }
                              >
                                {p.review.length}
                                <ChevronDown className={`size-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">–</span>
                            )}
                          </td>
                          <td className={`px-1 py-1 ${diffClass(e.horas, entry?.horasDescontadas ?? 0)}`}>
                            <Input value={e.horas} onChange={(ev) => setEdits((prev) => ({ ...prev, [p.employeeId]: { ...e, horas: ev.target.value } }))} className="h-7 w-20 text-right tabular-nums" />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{entry?.horasDescontadas ?? 0}</td>
                          <td className={`px-1 py-1 ${diffClass(e.dias, entry?.diasDescontados ?? 0)}`}>
                            <Input value={e.dias} onChange={(ev) => setEdits((prev) => ({ ...prev, [p.employeeId]: { ...e, dias: ev.target.value } }))} className="h-7 w-16 text-right tabular-nums" />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{entry?.diasDescontados ?? 0}</td>
                          <td className={`px-1 py-1 ${p.overtimeMinutes > 0 ? diffClass(e.extras, entry?.extraHours ?? 0) : ""}`}>
                            <Input
                              value={e.extras}
                              disabled={p.overtimeMinutes === 0}
                              onChange={(ev) => setEdits((prev) => ({ ...prev, [p.employeeId]: { ...e, extras: ev.target.value } }))}
                              className="h-7 w-16 text-right tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{entry?.extraHours ?? 0}</td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border bg-muted/20">
                            <td />
                            <td colSpan={10} className="px-2 py-2 text-xs text-muted-foreground">
                              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                                {p.review.map((r) => (
                                  <li key={r.date}>
                                    <span className="font-medium text-foreground">{formatDate(lang, r.date)}</span> · {r.flags.map((f) => tt(FLAG_KEY[f])).join(", ")}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">{tt("att_footnote")}</p>
          </>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={proposals.every((p) => p.review.length === 0)} onClick={() => void copyReview()}>
              <ClipboardCopy className="size-3.5" />
              {tt("att_copy_review")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={applying} onClick={() => void clearHours()}>
              <Trash2 className="size-3.5" />
              {tt("att_clear")}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
              {tt("action_cancel")}
            </Button>
            <Button type="button" onClick={() => void apply()} disabled={applying || selected.size === 0 || proposals.length === 0}>
              {applying ? tt("saving") : `${tt("att_apply")} (${selected.size})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {dialog}
    </>
  );
}
