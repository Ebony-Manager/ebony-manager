"use client";

import * as React from "react";
import { ChevronDown, Clock, MapPin, Smartphone, Undo2, Upload } from "lucide-react";
import toast from "react-hot-toast";

import { BLOCKING_FLAGS, type DayFlag, type DayResult, type RawPunch } from "@/lib/attendance/types";
import type { AttendanceStatus, StoredResolution } from "@/services/attendance";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseClockReport, parseCsv, parseJotformPunches } from "@/lib/attendance/parse";
import { buildProposal, periodDateRange, type EmployeeProposal, type ProposalEmployee } from "@/lib/attendance/proposal";
import { currentPeriod, monthLabel, nextPeriod, previousPeriod, type Period } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  getAttendanceAction,
  getRegistroAction,
  importPunchesAction,
  linkAttendanceNameAction,
  unlinkAttendanceNameAction,
  unresolveAttendanceDayAction,
} from "./actions";
import { AttendanceImportDialog } from "./attendance-import-dialog";
import { AttendanceDayDialog } from "./attendance-day-dialog";
import { Stepper } from "@/components/shared/page-header";

type Row = Awaited<ReturnType<typeof getRegistroAction>>[number];
interface Loaded {
  period: Period;
  rows: Row[];
  punches: RawPunch[];
  links: Record<string, string | null>;
  status: AttendanceStatus;
  resolutions: StoredResolution[];
}

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const IGNORE = "__ignore__";
const withoutKey = <T,>(obj: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...obj };
  delete next[key];
  return next;
};

const FLAG_KEY: Record<DayFlag, keyof typeof strings.planilla> = {
  absent: "att_flag_absent",
  missing_out: "att_flag_missing_out",
  missing_in: "att_flag_missing_in",
  unclear: "att_flag_unclear",
  early_leave: "att_flag_early",
  sunday_punch: "att_flag_sunday",
};
const WEEKDAYS = { es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };

/** Texto de un archivo de marcaciones a filas: CSV o la primera hoja de un xlsx. */
async function readRows(file: File): Promise<string[][]> {
  if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, blankrows: false }) as string[][];
  }
  return parseCsv(await file.text());
}

/**
 * Personal → Pagos → Asistencia. Las ponchadas se guardan en la app: las del
 * Jotform "Punch In/Out" llegan solas (webhook) y las del reloj del taller se
 * suben con su archivo (subirlo dos veces no duplica). Por quincena se ve,
 * persona por persona, sus llegadas tarde, faltas y días a revisar, y al
 * abrirla el detalle día por día con cada marcación. Un día al que le falta
 * la entrada o la salida se revisa a mano (`AttendanceDayDialog`): mientras
 * no, esa persona no pasa a la Quincena. "Pasar a la Quincena" abre la
 * propuesta (`AttendanceImportDialog`) para aplicarla.
 */
export function AsistenciaView({ onApplied }: { onApplied: () => void }) {
  const { lang } = useLang();
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);

  const [period, setPeriod] = React.useState<Period>(() => currentPeriod());
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [uploading, setUploading] = React.useState(false);
  // Nombre sin vincular → a quién se eligió, esperando la confirmación (un error acá cambiaría las horas de alguien).
  const [pendingLinks, setPendingLinks] = React.useState<Record<string, string>>({});
  const [reviewing, setReviewing] = React.useState<{ employee: { id: string; name: string }; day: DayResult } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(() => {
    const p = period;
    const range = periodDateRange(p.year, p.month, p.half);
    startTransition(async () => {
      const [rows, att] = await Promise.all([getRegistroAction(p.year, p.month, p.half), getAttendanceAction(range.from, range.to)]);
      setLoaded({ period: p, rows, ...att });
    });
  }, [period]);

  React.useEffect(() => {
    load();
  }, [load]);

  const ready = loaded && loaded.period.year === period.year && loaded.period.month === period.month && loaded.period.half === period.half;
  const range = periodDateRange(period.year, period.month, period.half);
  const links = React.useMemo(() => new Map(Object.entries(loaded?.links ?? {})), [loaded]);
  const employees: ProposalEmployee[] = React.useMemo(
    () =>
      (loaded?.rows ?? []).map((r) => ({
        id: r.employee.id,
        name: r.employee.name,
        status: r.employee.status,
        categoria: r.employee.categoria,
        startDate: r.employee.startDate,
        endDate: r.employee.endDate,
        monthlySalaryCents: r.monthlySalaryCents,
      })),
    [loaded]
  );
  const { proposals, unmatched } = React.useMemo(
    () =>
      ready
        ? buildProposal({ from: range.from, to: range.to, punches: loaded.punches, employees, links, resolutions: loaded.resolutions, today: todayInPanama() })
        : { proposals: [], unmatched: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range sale de `period`, que ya define `ready`.
    [ready, loaded, employees, links]
  );
  const rowById = React.useMemo(() => new Map((loaded?.rows ?? []).map((r) => [r.employee.id, r])), [loaded]);
  const punchCount = (name: string) => (loaded?.punches ?? []).filter((p) => p.name === name).length;

  async function onFile(kind: "reloj" | "jotform", input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const data = await readRows(file);
      const punches = kind === "reloj" ? parseClockReport(data) : parseJotformPunches(data);
      if (punches.length === 0) {
        toast.error(tp("att_file_empty"));
        return;
      }
      const { inserted, existing } = await importPunchesAction(punches);
      toast.success(`${tg("att_uploaded")}: ${inserted} ${tg("att_new")} · ${existing} ${tg("att_already")}`);
      load();
    } catch (err) {
      console.error("Asistencia: no se pudo subir el archivo", err);
      toast.error(tp("att_file_error"));
    } finally {
      setUploading(false);
    }
  }

  async function link(name: string, value: string) {
    try {
      await linkAttendanceNameAction(name, value === IGNORE ? null : value);
      toast.success(tg("att_linked"));
      setPendingLinks((prev) => withoutKey(prev, name));
      load();
    } catch (err) {
      console.error("Asistencia: no se pudo vincular el nombre", err);
      toast.error(tp("save_failed"));
    }
  }

  async function unlink(nameKey: string) {
    try {
      await unlinkAttendanceNameAction(nameKey);
      toast.success(tg("att_unlinked"));
      load();
    } catch (err) {
      console.error("Asistencia: no se pudo deshacer el vínculo", err);
      toast.error(tp("save_failed"));
    }
  }

  async function unresolve(employeeId: string, date: string) {
    try {
      await unresolveAttendanceDayAction(employeeId, date);
      load();
    } catch (err) {
      console.error("Asistencia: no se pudo deshacer la revisión", err);
      toast.error(tp("save_failed"));
    }
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const label = `${monthLabel(lang, period.month)} · ${period.half === 1 ? tp("quincena_1") : tp("quincena_2")} ${period.year}`;
  const when = (s: { date: string; minutes: number } | null) => (s ? `${formatDateCompact(lang, s.date)} ${hm(s.minutes)}` : tg("att_never"));
  const th = "px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap";
  const uploadBtn = "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border sm:h-8 border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stepper
          fill
          label={label}
          onPrev={() => setPeriod((p) => previousPeriod(p.year, p.month, p.half))}
          onNext={() => setPeriod((p) => nextPeriod(p))}
        />
        {/* Celular: las dos subidas lado a lado y "Pasar a la Quincena" a todo el ancho. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <label className={`${uploadBtn} ${uploading ? "pointer-events-none opacity-50" : ""}`}>
            <Upload className="size-3.5" />
            {tg("att_upload_clock")}
            <input type="file" accept=".csv" className="sr-only" onChange={(e) => void onFile("reloj", e.currentTarget)} />
          </label>
          <label className={`${uploadBtn} ${uploading ? "pointer-events-none opacity-50" : ""}`}>
            <Upload className="size-3.5" />
            {tg("att_upload_jotform")}
            <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => void onFile("jotform", e.currentTarget)} />
          </label>
          <Button size="sm" className="col-span-2 h-9 sm:h-8" disabled={!ready} onClick={() => setApplyOpen(true)}>
            {tg("att_to_quincena")}
          </Button>
        </div>
      </div>

      {ready && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="size-3.5" />
            {tg("att_last_jotform")}: <span className="font-medium text-foreground">{when(loaded.status.lastJotform)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {tg("att_last_clock")}: <span className="font-medium text-foreground">{when(loaded.status.lastReloj)}</span>
          </span>
        </div>
      )}

      {ready && unmatched.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-foreground">{tg("att_unmatched_title")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{tg("att_unmatched_hint")}</p>
          <ul className="flex flex-col gap-2">
            {unmatched.map((name) => (
              <li key={name} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40 font-medium text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">
                  {punchCount(name)} {tp("att_punches")}
                </span>
                <Select value={pendingLinks[name] ?? ""} onValueChange={(v) => setPendingLinks((prev) => ({ ...prev, [name]: v }))}>
                  <SelectTrigger className="h-8 w-60">
                    <SelectValue placeholder={tg("att_link_to")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value={IGNORE}>{tg("att_not_employee")}</SelectItem>
                    {employees
                      .filter((e) => e.status === "ACTIVE")
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {pendingLinks[name] && (
                  <span className="flex items-center gap-1">
                    <Button size="sm" className="h-8" onClick={() => void link(name, pendingLinks[name])}>
                      {tg("att_link_confirm")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setPendingLinks((prev) => withoutKey(prev, name))}
                    >
                      {tp("action_cancel")}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready && Object.keys(loaded.links).length > 0 && (
        <details className="rounded-lg border border-border px-4 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {tg("att_links_title")} ({Object.keys(loaded.links).length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {Object.entries(loaded.links)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, employeeId]) => (
                <li key={key} className="flex flex-wrap items-center gap-2 border-b border-border/60 py-1 last:border-0">
                  <span className="min-w-40 capitalize text-foreground">{key}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground">
                    {employeeId ? (employees.find((e) => e.id === employeeId)?.name ?? "—") : tg("att_not_employee")}
                  </span>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-muted-foreground" onClick={() => void unlink(key)}>
                    <Undo2 className="size-3" />
                    {tg("att_day_undo")}
                  </Button>
                </li>
              ))}
          </ul>
        </details>
      )}

      <div className="rounded-lg border border-border bg-card">
        {!ready || pending ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{tp("loading")}</p>
        ) : proposals.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{tg("att_no_punches")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={`${th} sticky left-0 z-10 bg-card`}>{tp("col_empleado")}</th>
                  <th className={`${th} text-right`}>{tg("att_col_days")}</th>
                  <th className={`${th} text-right`}>{tg("att_col_late_count")}</th>
                  <th className={`${th} text-right`}>{tp("att_col_late")}</th>
                  <th className={`${th} text-right`}>{tg("att_col_early")}</th>
                  <th className={`${th} text-right`}>{tg("att_col_absent")}</th>
                  <th className={`${th} text-right`}>{tp("att_col_review")}</th>
                  <th className={`${th} text-right`}>{tg("att_col_in_quincena")}</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const isOpen = expanded.has(p.employeeId);
                  const entry = rowById.get(p.employeeId)?.total.entry;
                  const daysWithPunches = p.days.filter((d) => d.arrival !== null || d.departure !== null).length;
                  const lateDays = p.days.filter((d) => d.lateMinutes > 0).length;
                  const absent = p.absentWeekdays + p.absentSaturdays;
                  const inQuincena = [
                    entry?.horasDescontadas ? `${entry.horasDescontadas} h` : "",
                    entry?.diasDescontados ? `${entry.diasDescontados} d` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <React.Fragment key={p.employeeId}>
                      <tr className="group/row cursor-pointer border-b border-border hover:bg-muted/30" onClick={() => toggle(p.employeeId)}>
                        {/* Nombre fijo a la izquierda al deslizar la tabla (celular). */}
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground group-hover/row:bg-muted/30">
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                            {p.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{daysWithPunches}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{lateDays || "–"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.lateMinutes ? hm(p.lateMinutes) : "–"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.earlyLeaveMinutes ? hm(p.earlyLeaveMinutes) : "–"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{absent || "–"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.blockingDays ? <span className="font-medium text-amber-600 dark:text-amber-400">{p.blockingDays}</span> : "–"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{inQuincena || "–"}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border bg-muted/20">
                          <td colSpan={8} className="px-3 py-2">
                            <DayTable
                              proposal={p}
                              onReview={(day) => setReviewing({ employee: { id: p.employeeId, name: p.name }, day })}
                              onUnresolve={(date) => void unresolve(p.employeeId, date)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{tp("att_footnote")}</p>

      {ready && (
        <AttendanceImportDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          period={loaded.period}
          rows={loaded.rows}
          punches={loaded.punches}
          links={links}
          resolutions={loaded.resolutions}
          onApplied={() => {
            load();
            onApplied();
          }}
        />
      )}
      {reviewing && (
        <AttendanceDayDialog
          open={reviewing !== null}
          onOpenChange={(o) => !o && setReviewing(null)}
          employee={reviewing.employee}
          day={reviewing.day}
          onSaved={load}
        />
      )}
    </div>
  );
}

/** Detalle día por día de una persona: entrada, salida, tardanza, cada marcación (reloj o Jotform) y observaciones. */
function DayTable({
  proposal,
  onReview,
  onUnresolve,
}: {
  proposal: EmployeeProposal;
  onReview: (day: DayResult) => void;
  onUnresolve: (date: string) => void;
}) {
  const { lang } = useLang();
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const byDate = new Map<string, RawPunch[]>();
  for (const x of proposal.punches) byDate.set(x.date, [...(byDate.get(x.date) ?? []), x]);
  const dth = "px-2 py-1 text-left text-[11px] font-medium text-muted-foreground";
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className={dth}>{tg("att_day")}</th>
          <th className={`${dth} text-right`}>{tg("att_in")}</th>
          <th className={`${dth} text-right`}>{tg("att_out")}</th>
          <th className={`${dth} text-right`}>{tg("att_late")}</th>
          <th className={`${dth} text-right`}>{tg("att_early")}</th>
          <th className={dth}>{tg("att_punches_col")}</th>
          <th className={dth}>{tg("att_notes")}</th>
          <th className={dth} />
        </tr>
      </thead>
      <tbody>
        {proposal.days.map((d) => {
          const punches = (byDate.get(d.date) ?? []).sort((a, b) => a.minutes - b.minutes);
          const flags = d.flags.map((f) => tp(FLAG_KEY[f]));
          const sunday = d.weekday === 0;
          const blocking = d.flags.some((f) => BLOCKING_FLAGS.includes(f));
          if (sunday && punches.length === 0) return null;
          return (
            <tr key={d.date} className="border-t border-border/60">
              <td className="whitespace-nowrap px-2 py-1 text-foreground">
                <span className="inline-block w-8 text-muted-foreground">{WEEKDAYS[lang][d.weekday]}</span>
                {formatDateCompact(lang, d.date)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">{d.arrival !== null ? hm(d.arrival) : "–"}</td>
              <td className="px-2 py-1 text-right tabular-nums">{d.departure !== null ? hm(d.departure) : "–"}</td>
              <td className={`px-2 py-1 text-right tabular-nums ${d.lateMinutes ? "text-destructive" : ""}`}>{d.lateMinutes ? hm(d.lateMinutes) : "–"}</td>
              <td className={`px-2 py-1 text-right tabular-nums ${d.earlyLeaveMinutes ? "text-destructive" : ""}`}>{d.earlyLeaveMinutes ? hm(d.earlyLeaveMinutes) : "–"}</td>
              <td className="px-2 py-1">
                <span className="flex flex-wrap gap-1">
                  {punches.map((x, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 tabular-nums"
                      title={x.source === "reloj" ? tg("att_src_clock") : tg("att_src_jotform")}
                    >
                      {x.source === "reloj" ? <Clock className="size-3 text-muted-foreground" /> : <Smartphone className="size-3 text-muted-foreground" />}
                      {hm(x.minutes)}
                      {x.kind !== "unknown" && <span className="text-muted-foreground">{x.kind === "in" ? tg("att_in_short") : tg("att_out_short")}</span>}
                      {x.location && (
                        <a href={x.location} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                          <MapPin className="size-3" />
                        </a>
                      )}
                    </span>
                  ))}
                </span>
              </td>
              <td className={`px-2 py-1 ${blocking ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                {[...flags, ...(d.resolution ? [`${tg("att_day_reviewed")}${d.resolution.note ? `: ${d.resolution.note}` : ""}`] : [])].join(", ")}
              </td>
              <td className="whitespace-nowrap px-2 py-1 text-right">
                {d.resolution ? (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" title={tg("att_day_undo")} onClick={() => onUnresolve(d.date)}>
                    <Undo2 className="size-3" />
                    {tg("att_day_undo")}
                  </Button>
                ) : blocking || d.flags.includes("absent") ? (
                  <Button size="sm" variant={blocking ? "default" : "outline"} className="h-6 px-2 text-[11px]" onClick={() => onReview(d)}>
                    {tg("att_day_review")}
                  </Button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
