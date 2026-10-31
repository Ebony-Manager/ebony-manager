"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileDown, Inbox, TriangleAlert, X } from "lucide-react";

import type { InspectionKind, InspectionSchedule, ScheduleBoard, ScheduleItem } from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/shared/kpi-card";
import { RowMenu } from "@/components/shared/row-menu";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ListToolbar } from "@/components/shared/search-input";
import { EmptyState, PAGE_CLASS, PageHeader, SectionHeader, Stepper } from "@/components/shared/page-header";
import { addDays, compliance, scheduleState, weekDays, type ScheduleState } from "@/lib/inspections/schedule";
import { cn } from "@/lib/utils";
import { cancelScheduleAction, moveScheduleAction } from "../actions";
import { DetailTags, KIND_KEY } from "../detail-fields";
import { inspectionsPath } from "../paths";
import { InspeccionesTabs, SCHEDULE_PATH, useTi } from "../shared";
import { ScheduleDialog } from "./schedule-dialog";
import { PlanDialog } from "./plan-dialog";

type View = "week" | "pending";
type KindFilter = "todos" | InspectionKind;

/** Color del borde y del estado de una programación (los del tema). */
export const STATE_COLOR: Record<ScheduleState, string> = {
  programado: "var(--primary)",
  hecho: "var(--success)",
  vencido: "var(--destructive)",
};

/** "lun 3" / "Mon 3" (y en largo "lunes 3 nov"). */
export function useDayLabel() {
  const { lang } = useTi();
  return React.useCallback(
    (iso: string, long = false) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === "en" ? "en-US" : "es-PA", {
        timeZone: "UTC",
        weekday: long ? "long" : "short",
        day: "numeric",
        ...(long ? { month: "short" } : {}),
      });
    },
    [lang],
  );
}

/**
 * Inspecciones → Programación: los detalles pendientes se reparten por
 * persona y día (con orden). Arriba los números de la semana y lo vencido;
 * la semana día por día (columnas en computadora, un día a la vez en el
 * celular) y la lista de lo que falta programar. "Plan" descarga el de cada
 * persona (PDF o texto para WhatsApp). Abajo, el cumplimiento de cada uno.
 */
export function ScheduleView({ board, monday, today }: { board: ScheduleBoard; monday: string; today: string }) {
  const { ti, lang } = useTi();
  const router = useRouter();
  const dayLabel = useDayLabel();
  const days = weekDays(monday);
  const [view, setView] = React.useState<View>("week");
  const [person, setPerson] = React.useState("all");
  const [project, setProject] = React.useState("all");
  const [kind, setKind] = React.useState<KindFilter>("todos");
  const [mobileDay, setMobileDay] = React.useState(() => (days.includes(today) ? today : days[0]));
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [scheduling, setScheduling] = React.useState<{ itemIds: string[]; from?: InspectionSchedule } | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);

  const itemById = React.useMemo(() => new Map(board.items.map((i) => [i.id, i])), [board.items]);
  const itemOk = (it: ScheduleItem | undefined) =>
    !!it && (project === "all" || it.projectId === project) && (kind === "todos" || it.kind === kind);
  const open = board.schedules.filter((s) => s.outcome === "programado");
  const openByItem = new Map(open.map((s) => [s.itemId, s]));
  const inWeek = board.schedules.filter(
    (s) => days.includes(s.date) && (s.outcome === "programado" || s.outcome === "hecho") && (person === "all" || s.personId === person) && itemOk(itemById.get(s.itemId)),
  );
  const overdue = open
    .filter((s) => s.date < today && (person === "all" || s.personId === person) && itemOk(itemById.get(s.itemId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const pending = board.items.filter((i) => i.status === "pendiente" && !openByItem.has(i.id) && itemOk(i));
  const allPending = board.items.filter((i) => i.status === "pendiente" && !openByItem.has(i.id)).length;
  const comp = compliance(board.schedules, addDays(today, -30), today);

  const projects = [...new Map(board.items.map((i) => [i.projectId, i.projectName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const weekPeople = [...new Map(board.schedules.filter((s) => s.outcome === "programado" || s.outcome === "hecho").map((s) => [s.personId, s.personName])).entries()];
  const peopleOptions = [...new Map([...weekPeople, ...board.people.map((p) => [p.id, p.name] as [string, string])]).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const y = Number(monday.slice(0, 4));
  const sat = addDays(monday, 5);
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    const [yy, mm, dd] = iso.split("-").map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { timeZone: "UTC", ...opts });
  };
  const weekLabel = `${fmt(monday, { day: "numeric", month: "short" })} – ${fmt(sat, { day: "numeric", month: "short" })} ${y}`;
  const goWeek = (delta: number) => router.push(`${SCHEDULE_PATH}?semana=${addDays(monday, delta * 7)}`);

  async function move(s: InspectionSchedule, dir: -1 | 1) {
    const res = await moveScheduleAction(s.id, dir);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }
  async function unschedule(s: InspectionSchedule) {
    const res = await cancelScheduleAction(s.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ti("sch_removed"));
    router.refresh();
  }

  const card = (s: InspectionSchedule, showWhen = false) => (
    <ScheduleCard
      key={s.id}
      schedule={s}
      item={itemById.get(s.itemId)}
      state={scheduleState(s, today)}
      when={showWhen ? `${dayLabel(s.date)} · ${s.personName}` : undefined}
      onMove={(dir) => void move(s, dir)}
      onReschedule={() => setScheduling({ itemIds: [s.itemId], from: s })}
      onRemove={() => void unschedule(s)}
    />
  );

  /** Lo de un día, agrupado por persona y en su orden. */
  const dayContent = (day: string) => {
    const list = inWeek.filter((s) => s.date === day).sort((a, b) => a.personName.localeCompare(b.personName) || a.order - b.order);
    if (list.length === 0) return <p className="px-1 py-4 text-center text-xs text-muted-foreground">{ti("sch_day_empty")}</p>;
    const groups = new Map<string, InspectionSchedule[]>();
    for (const s of list) groups.set(s.personId, [...(groups.get(s.personId) ?? []), s]);
    return [...groups.values()].map((g) => (
      <div key={g[0].personId} className="flex flex-col gap-1.5">
        <p className="px-1 text-xs font-semibold text-foreground">{g[0].personName}</p>
        {g.map((s) => card(s))}
      </div>
    ));
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={ti("sch_title")}
        subtitle={ti("sch_subtitle")}
        action={
          <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}>
            <FileDown className="size-3.5" />
            {ti("sch_plan")}
          </Button>
        }
      />
      <InspeccionesTabs value="programacion" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard icon={CalendarDays} tone="primary" label={ti("sch_kpi_week")} value={inWeek.length} sublabel={ti("sch_kpi_week_hint")} />
        <KpiCard icon={CheckCircle2} tone="positive" label={ti("sch_kpi_done")} value={inWeek.filter((s) => s.outcome === "hecho").length} sublabel={ti("sch_kpi_week_hint")} />
        <KpiCard icon={TriangleAlert} tone={overdue.length ? "negative" : "neutral"} label={ti("sch_kpi_overdue")} value={overdue.length} />
        <KpiCard icon={Inbox} tone="warning" label={ti("sch_kpi_pending")} value={allPending} onClick={() => setView("pending")} />
      </div>

      {overdue.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <TriangleAlert className="size-4" />
            {ti("sch_overdue_title")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{overdue.map((s) => card(s, true))}</div>
        </section>
      )}

      <ListToolbar>
        {view === "week" && (
          <Stepper label={weekLabel} onPrev={() => goWeek(-1)} onNext={() => goWeek(1)} fill />
        )}
        <Select value={person} onValueChange={setPerson}>
          <SelectTrigger className="h-9 w-auto min-w-40">
            <SelectValue>{person === "all" ? ti("sch_all_people") : peopleOptions.find(([id]) => id === person)?.[1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ti("sch_all_people")}</SelectItem>
            {peopleOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-9 w-auto min-w-40 max-w-64">
            <SelectValue>{project === "all" ? ti("sch_all_projects") : projects.find(([id]) => id === project)?.[1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ti("sch_all_projects")}</SelectItem>
            {projects.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedFilter
          value={kind}
          onChange={setKind}
          options={[
            { value: "todos", label: ti("sch_kind_all") },
            { value: "pintura", label: ti(KIND_KEY.pintura) },
            { value: "carpinteria", label: ti(KIND_KEY.carpinteria) },
            { value: "otro", label: ti(KIND_KEY.otro) },
          ]}
        />
        <SegmentedFilter
          className="ml-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "week", label: ti("sch_view_week"), icon: CalendarDays },
            { value: "pending", label: `${ti("sch_view_pending")} (${allPending})`, icon: ClipboardList },
          ]}
        />
      </ListToolbar>

      {view === "week" ? (
        <>
          {/* Celular: un día a la vez. */}
          <div className="flex flex-col gap-3 lg:hidden">
            <SegmentedFilter
              fill
              value={mobileDay}
              onChange={setMobileDay}
              options={days.map((day) => ({ value: day, label: `${dayLabel(day)} (${inWeek.filter((s) => s.date === day).length})` }))}
            />
            {dayContent(mobileDay)}
          </div>
          {/* Computadora: la semana en columnas. */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-6">
            {days.map((day) => (
              <section key={day} className={cn("flex min-w-0 flex-col gap-2 rounded-lg bg-muted/40 p-2", day === today && "ring-2 ring-primary/40")}>
                <header className="flex items-center justify-between px-1 pt-0.5 text-sm font-semibold text-foreground">
                  <span className="capitalize">{dayLabel(day)}</span>
                  <span className="font-normal text-muted-foreground">{inWeek.filter((s) => s.date === day).length}</span>
                </header>
                {dayContent(day)}
              </section>
            ))}
          </div>
        </>
      ) : (
        <PendingList
          items={pending}
          selected={selected}
          onToggle={toggle}
          onSetMany={(ids, on) =>
            setSelected((prev) => {
              const next = new Set(prev);
              for (const id of ids) {
                if (on) next.add(id);
                else next.delete(id);
              }
              return next;
            })
          }
          onSchedule={() => setScheduling({ itemIds: [...selected].filter((id) => pending.some((p) => p.id === id)) })}
          empty={board.items.some((i) => i.status === "pendiente") ? ti("sch_pending_empty") : ti("sch_none")}
        />
      )}

      <section className="flex flex-col gap-2">
        <SectionHeader title={ti("sch_compliance_title")} subtitle={ti("sch_compliance_hint")} />
        {comp.length === 0 ? (
          <EmptyState className="py-6">{ti("sch_compliance_empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col rounded-lg border border-border bg-card">
            {comp.map((c) => (
              <li key={c.personId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3.5 py-2.5 last:border-0">
                <span className="min-w-36 flex-1 text-sm font-medium text-foreground">{c.personName}</span>
                <span className="text-xs text-muted-foreground">
                  {c.onTime} {ti("sch_on_time")} · {c.late} {ti("sch_late")} · {c.missed} {ti("sch_missed")}
                </span>
                <span className="flex w-36 items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${Math.round((c.rate ?? 0) * 100)}%`, backgroundColor: (c.rate ?? 0) >= 0.8 ? "var(--success)" : (c.rate ?? 0) >= 0.5 ? "var(--warning)" : "var(--destructive)" }} />
                  </span>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">{c.rate == null ? "—" : `${Math.round(c.rate * 100)}%`}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ScheduleDialog
        request={scheduling}
        people={board.people}
        items={itemById}
        defaultDate={days.includes(today) ? today : monday}
        onClose={() => setScheduling(null)}
        onDone={() => {
          setScheduling(null);
          setSelected(new Set());
          setView("week");
          router.refresh();
        }}
      />
      <PlanDialog open={planOpen} onClose={() => setPlanOpen(false)} days={days} schedules={board.schedules} items={itemById} defaultPerson={person === "all" ? null : person} />
    </div>
  );
}

/** Un detalle programado: orden, foto, obra, área, qué hacer, nota y estado (color al borde). */
function ScheduleCard({
  schedule: s,
  item,
  state,
  when,
  onMove,
  onReschedule,
  onRemove,
}: {
  schedule: InspectionSchedule;
  item: ScheduleItem | undefined;
  state: ScheduleState;
  when?: string;
  onMove: (dir: -1 | 1) => void;
  onReschedule: () => void;
  onRemove: () => void;
}) {
  const { ti } = useTi();
  const thumb = item?.photos[0]?.url;
  const open = s.outcome === "programado";
  return (
    <div className="flex gap-2 rounded-lg border border-l-[3px] border-border bg-card px-2.5 py-2" style={{ borderLeftColor: STATE_COLOR[state] }}>
      <span className="flex flex-col items-center gap-1">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">{s.order}</span>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- foto firmada del detalle.
          <img src={thumb} alt="" loading="lazy" className="size-9 rounded object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {when && <span className="block text-[11px] font-medium capitalize text-destructive">{when}</span>}
        <span className="block truncate text-[11px] text-muted-foreground">{item?.projectName ?? "—"}</span>
        <span className="block text-sm leading-snug font-semibold text-foreground">{item?.area?.trim() || item?.comment || "—"}</span>
        {item?.area?.trim() && <span className="line-clamp-2 text-xs text-muted-foreground">{item.comment}</span>}
        {s.note && <span className="mt-0.5 block text-[11px] text-muted-foreground italic">{s.note}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] leading-none font-medium" style={{ color: STATE_COLOR[state], backgroundColor: `color-mix(in oklch, ${STATE_COLOR[state]} 12%, transparent)` }}>
            {ti(`sch_state_${state}`)}
          </span>
          {item && <DetailTags item={{ ...item, painterName: null }} />}
        </span>
      </span>
      <span className="-mt-1 -mr-1.5">
        <RowMenu
          label={ti("sch_reschedule")}
          items={[
            ...(open
              ? [
                  { label: ti("sch_up"), icon: ArrowUp, onSelect: () => onMove(-1) },
                  { label: ti("sch_down"), icon: ArrowDown, onSelect: () => onMove(1) },
                  { label: ti("sch_reschedule"), icon: CalendarClock, onSelect: onReschedule },
                ]
              : []),
            ...(item ? [{ label: ti("sch_open_item"), icon: ExternalLink, onSelect: () => window.location.assign(inspectionsPath(item.projectId)) }] : []),
            ...(open ? [{ label: ti("sch_unschedule"), icon: X, onSelect: onRemove, confirmLabel: ti("sch_unschedule_q") }] : []),
          ]}
        />
      </span>
    </div>
  );
}

/** Lo pendiente sin programar, por obra: se marcan y se programan juntos. */
function PendingList({
  items,
  selected,
  onToggle,
  onSetMany,
  onSchedule,
  empty,
}: {
  items: ScheduleItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
  onSchedule: () => void;
  empty: string;
}) {
  const { ti } = useTi();
  const chosen = items.filter((i) => selected.has(i.id)).length;
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  const groups = new Map<string, ScheduleItem[]>();
  for (const i of items) groups.set(i.projectId, [...(groups.get(i.projectId) ?? []), i]);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{ti("sch_select_hint")}</p>
        <Button size="sm" disabled={chosen === 0} onClick={onSchedule}>
          <CalendarClock className="size-3.5" />
          {ti("sch_schedule_n", { n: chosen })}
        </Button>
      </div>
      {[...groups.entries()].map(([projectId, list]) => {
        const all = list.every((i) => selected.has(i.id));
        return (
          <div key={projectId} className="overflow-hidden rounded-lg border border-border bg-card">
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
              <input type="checkbox" className="size-4 accent-primary" checked={all} onChange={(e) => onSetMany(list.map((i) => i.id), e.target.checked)} />
              <span className="min-w-0 flex-1 truncate">{list[0].projectName}</span>
              <span className="text-xs font-normal text-muted-foreground">{list.length}</span>
            </label>
            <ul>
              {list.map((i) => (
                <li key={i.id} className="border-b border-border last:border-0">
                  <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-muted/30">
                    <input type="checkbox" className="mt-1 size-4 accent-primary" checked={selected.has(i.id)} onChange={() => onToggle(i.id)} />
                    {i.photos[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto firmada del detalle.
                      <img src={i.photos[0].url} alt="" loading="lazy" className="size-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="size-10 shrink-0 rounded bg-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{i.area?.trim() || i.comment}</span>
                      {i.area?.trim() && <span className="line-clamp-2 block text-xs text-muted-foreground">{i.comment}</span>}
                      <DetailTags item={{ ...i, painterName: null }} className="mt-1" />
                    </span>
                    <Link href={inspectionsPath(i.projectId)} onClick={(e) => e.stopPropagation()} className="shrink-0 p-1 text-muted-foreground hover:text-foreground" title={ti("sch_open_item")} aria-label={ti("sch_open_item")}>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
