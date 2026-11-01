"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Eraser,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileDown,
  Inbox,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";

import type {
  InspectionKind,
  InspectionSchedule,
  ScheduleBoard,
  ScheduleItem,
} from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/shared/kpi-card";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ListToolbar } from "@/components/shared/search-input";
import {
  EmptyState,
  PAGE_CLASS,
  PageHeader,
  SectionHeader,
  Stepper,
} from "@/components/shared/page-header";
import {
  addDays,
  compliance,
  dayBlocks,
  weekDays,
  type DayBlock,
} from "@/lib/inspections/schedule";
import { cn } from "@/lib/utils";
import {
  assignSchedulesAction,
  planItemsAction,
  unplanItemsAction,
} from "../actions";
import { KIND_KEY } from "../detail-fields";
import { InspeccionesTabs, SCHEDULE_PATH, useTi } from "../shared";
import { AssignDialog, type AssignRequest } from "./assign-dialog";
import { BlockCard, BlockDetailDialog, Tray, type Pick } from "./board";
import { PlanDialog } from "./plan-dialog";

export { STATE_COLOR } from "./board";

type KindFilter = "todos" | InspectionKind;
const ALL = "all";
const NONE = "none";

/** "lun 3" / "Mon 3" (y en largo "lunes 3 nov"). */
export function useDayLabel() {
  const { lang } = useTi();
  return React.useCallback(
    (iso: string, long = false) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
        lang === "en" ? "en-US" : "es-PA",
        {
          timeZone: "UTC",
          weekday: long ? "long" : "short",
          day: "numeric",
          ...(long ? { month: "short" } : {}),
        },
      );
    },
    [lang],
  );
}

/**
 * Inspecciones → Programación: ponerle día a los detalles. La bandeja tiene
 * lo pendiente por obra → área → detalle; se arrastra a un día (o se toca y
 * se elige el día). Cada día muestra bloques obra · área en su orden; quién
 * lo atiende se asigna encima. "Plan" descarga la agenda de una obra o de una
 * persona (PDF o texto para WhatsApp). Abajo, el cumplimiento de cada uno.
 */
export function ScheduleView({
  board,
  monday,
  today,
}: {
  board: ScheduleBoard;
  monday: string;
  today: string;
}) {
  const { ti, lang } = useTi();
  const router = useRouter();
  const dayLabel = useDayLabel();
  const days = weekDays(monday);
  const [isPending, startTransition] = React.useTransition();
  const [person, setPerson] = React.useState(ALL);
  const [project, setProject] = React.useState(ALL);
  const [kind, setKind] = React.useState<KindFilter>("todos");
  const [mobileDay, setMobileDay] = React.useState(() =>
    days.includes(today) ? today : days[0],
  );
  const [pick, setPick] = React.useState<Pick | null>(null);
  const [dragging, setDragging] = React.useState<Pick | null>(null);
  const dragRef = React.useRef<Pick | null>(null);
  const [overDay, setOverDay] = React.useState<string | null>(null);
  const [assign, setAssign] = React.useState<AssignRequest | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<DayBlock | null>(null);
  const [trayOpen, setTrayOpen] = React.useState(true);

  const itemById = React.useMemo(
    () => new Map(board.items.map((i) => [i.id, i])),
    [board.items],
  );
  const itemOk = (it: ScheduleItem | undefined) =>
    !!it &&
    (project === ALL || it.projectId === project) &&
    (kind === "todos" || it.kind === kind);
  const personOk = (s: InspectionSchedule) =>
    person === ALL || (person === NONE ? !s.personId : s.personId === person);
  const open = board.schedules.filter((s) => s.outcome === "programado");
  const openByItem = new Map(open.map((s) => [s.itemId, s]));
  const inWeek = board.schedules.filter(
    (s) =>
      days.includes(s.date) &&
      (s.outcome === "programado" || s.outcome === "hecho") &&
      personOk(s) &&
      itemOk(itemById.get(s.itemId)),
  );
  // Limpiar: todo lo programado y abierto (de cualquier día) que entra en los filtros; lo hecho queda.
  const clearable = open.filter((s) => personOk(s) && itemOk(itemById.get(s.itemId)));
  const overdue = open.filter(
    (s) => s.date < today && personOk(s) && itemOk(itemById.get(s.itemId)),
  );
  const trayItems = board.items.filter(
    (i) => i.status === "pendiente" && !openByItem.has(i.id) && itemOk(i),
  );
  const allPending = board.items.filter(
    (i) => i.status === "pendiente" && !openByItem.has(i.id),
  ).length;
  const unassigned = inWeek.filter(
    (s) => s.outcome === "programado" && !s.personId,
  );
  const comp = compliance(board.schedules, addDays(today, -30), today);

  const projects = [
    ...new Map(board.items.map((i) => [i.projectId, i.projectName])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  // Un color por obra (en orden alfabético), el mismo en la bandeja y en las tarjetas.
  const colorIndex = new Map(projects.map(([id], i) => [id, i % 8]));
  const colorOf = (projectId: string) =>
    `var(--project-${(colorIndex.get(projectId) ?? 0) + 1})`;
  const scheduledPeople = board.schedules
    .filter((s) => s.personId)
    .map((s) => [s.personId!, s.personName ?? ""] as [string, string]);
  const peopleOptions = [
    ...new Map([
      ...scheduledPeople,
      ...board.people.map((p) => [p.id, p.name] as [string, string]),
    ]).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const defaultPerson =
    person !== ALL && person !== NONE
      ? (board.people.find((p) => p.id === person) ?? null)
      : null;

  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    const [yy, mm, dd] = iso.split("-").map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString(
      lang === "en" ? "en-US" : "es-PA",
      { timeZone: "UTC", ...opts },
    );
  };
  const weekLabel = `${fmt(monday, { day: "numeric", month: "short" })} – ${fmt(days[5], { day: "numeric", month: "short" })} ${monday.slice(0, 4)}`;
  const goWeek = (delta: number) =>
    router.push(`${SCHEDULE_PATH}?semana=${addDays(monday, delta * 7)}`);
  const refresh = () => startTransition(() => router.refresh());

  const blocksOf = (day: string) =>
    dayBlocks(
      inWeek.filter((s) => s.date === day),
      itemById,
    );
  /** La primera abierta del bloque (para poner algo "antes" de él). */
  const anchor = (b: DayBlock | undefined) =>
    b
      ? (b.schedules.find((s) => s.outcome === "programado") ?? b.schedules[0])
          .id
      : null;

  async function place(p: Pick, day: string, before: string | null) {
    setPick(null);
    if (p.itemIds.length === 0) return;
    const res = await planItemsAction(
      p.itemIds,
      day,
      before,
      defaultPerson ? { kind: defaultPerson.kind, id: defaultPerson.id } : null,
    );
    if (!res.ok) return void toast.error(res.error);
    refresh();
    if (p.scheduled) return;
    // Recién puesto desde la bandeja: se puede deshacer.
    toast.success(
      (tt) => (
        <span className="flex items-center gap-3">
          <span className="capitalize">
            {ti("sch_planned", { label: p.label, day: dayLabel(day) })}
          </span>
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={async () => {
              toast.dismiss(tt.id);
              const r = await unplanItemsAction(p.itemIds);
              if (!r.ok) toast.error(r.error);
              else refresh();
            }}
          >
            {ti("sch_undo")}
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  }

  async function assignPerson(
    ids: string[],
    p: { kind: "empleado" | "contratista"; id: string } | null,
  ) {
    const res = await assignSchedulesAction(ids, p);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ti("sch_saved"));
    refresh();
  }

  async function remove(itemIds: string[]) {
    setPick(null);
    if (itemIds.length === 0) return;
    const res = await unplanItemsAction(itemIds);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ti("sch_removed"));
    refresh();
  }

  const startDrag = (p: Pick) => {
    dragRef.current = p;
    setDragging(p);
    setPick(null);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
    setOverDay(null);
  };
  const dropOn = (day: string, before: string | null) => {
    const p = dragRef.current;
    endDrag();
    if (p) void place(p, day, before);
  };

  const prefer = (schedules: InspectionSchedule[]) => {
    const kinds = new Set(schedules.map((s) => itemById.get(s.itemId)?.kind));
    return kinds.size === 1 && kinds.has("pintura")
      ? "pintor"
      : kinds.size === 1 && kinds.has("carpinteria")
        ? "ebanista"
        : null;
  };

  const blockCard = (
    b: DayBlock,
    list: DayBlock[],
    i: number,
    opts: { when?: string } = {},
  ) => {
    const day = b.schedules[0].date;
    const openIds = b.schedules
      .filter((s) => s.outcome === "programado")
      .map((s) => s.itemId);
    return (
      <BlockCard
        key={`${b.key}|${day}`}
        block={b}
        items={itemById}
        today={today}
        showProject={project === ALL}
        when={opts.when}
        pick={pick}
        dropActive={!!dragging && !opts.when}
        onPick={setPick}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onDropBefore={() => dropOn(day, anchor(b))}
        onMove={
          opts.when
            ? undefined
            : (dir) => {
                if ((dir < 0 && i === 0) || (dir > 0 && i === list.length - 1))
                  return;
                void place(
                  { key: b.key, label: "", itemIds: openIds, scheduled: true },
                  day,
                  dir < 0 ? anchor(list[i - 1]) : anchor(list[i + 2]),
                );
              }
        }
        people={board.people}
        prefer={prefer(b.schedules)}
        color={colorOf(b.projectId)}
        onPerson={(p) =>
          void assignPerson(
            b.schedules
              .filter((s) => s.outcome === "programado")
              .map((s) => s.id),
            p,
          )
        }
        onNote={() =>
          setAssign({
            title: `${b.area ?? ti("no_area")} · ${dayLabel(day, true)}`,
            schedules: b.schedules.filter((s) => s.outcome === "programado"),
            prefer: prefer(b.schedules),
            withNote: true,
            noteOnly: true,
          })
        }
        onOpen={() => setDetail(b)}
        onRemove={() => void remove(openIds)}
        onItemMove={(s, dir) => {
          const k = b.schedules.indexOf(s);
          const before =
            dir < 0
              ? b.schedules[k - 1]?.id
              : (b.schedules[k + 2]?.id ?? anchor(list[i + 1]));
          if (dir < 0 && !before) return;
          void place(
            { key: s.id, label: "", itemIds: [s.itemId], scheduled: true },
            day,
            before ?? null,
          );
        }}
        onItemRemove={(s) => void remove([s.itemId])}
      />
    );
  };

  /** Una columna (o el día del celular): sus bloques en orden; se suelta encima o al final. */
  const dayColumn = (day: string, compact: boolean) => {
    const list = blocksOf(day);
    const count = list.reduce((n, b) => n + b.schedules.length, 0);
    return (
      <section
        key={day}
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          setOverDay(day);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setOverDay((d) => (d === day ? null : d));
        }}
        onDrop={(e) => {
          e.preventDefault();
          dropOn(day, null);
        }}
        className={cn(
          "flex min-w-0 flex-col gap-2 rounded-lg bg-muted/40 p-2 transition-colors",
          day === today && "ring-2 ring-primary/40",
          (dragging || pick) && "outline-2 outline-dashed outline-primary/30",
          overDay === day && "bg-primary/10",
        )}
      >
        {!compact && (
          <header className="flex items-center justify-between px-1 pt-0.5 text-sm font-semibold text-foreground">
            <span className="capitalize">{dayLabel(day)}</span>
            <span className="font-normal text-muted-foreground">{count}</span>
          </header>
        )}
        {pick && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => void place(pick, day, null)}
          >
            {ti("sch_place_here")}
          </Button>
        )}
        {list.map((b, i) => blockCard(b, list, i))}
        {list.length === 0 && !pick && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {dragging ? ti("sch_drop_here") : ti("sch_day_empty")}
          </p>
        )}
      </section>
    );
  };

  const overdueBlocks = [...new Set(overdue.map((s) => s.date))]
    .sort()
    .flatMap((date) =>
      dayBlocks(
        overdue.filter((s) => s.date === date),
        itemById,
      ),
    );

  return (
    <div className={cn(PAGE_CLASS, pick && "pb-28")}>
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
        <KpiCard
          icon={CalendarDays}
          tone="primary"
          label={ti("sch_kpi_week")}
          value={inWeek.length}
          sublabel={
            unassigned.length
              ? ti("sch_kpi_unassigned", { n: unassigned.length })
              : ti("sch_kpi_week_hint")
          }
        />
        <KpiCard
          icon={CheckCircle2}
          tone="positive"
          label={ti("sch_kpi_done")}
          value={inWeek.filter((s) => s.outcome === "hecho").length}
          sublabel={ti("sch_kpi_week_hint")}
        />
        <KpiCard
          icon={TriangleAlert}
          tone={overdue.length ? "negative" : "neutral"}
          label={ti("sch_kpi_overdue")}
          value={overdue.length}
        />
        <KpiCard
          icon={Inbox}
          tone="warning"
          label={ti("sch_kpi_pending")}
          value={allPending}
          onClick={() => setTrayOpen(true)}
        />
      </div>

      {overdueBlocks.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <TriangleAlert className="size-4" />
            {ti("sch_overdue_title")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {overdueBlocks.map((b, i) =>
              blockCard(b, overdueBlocks, i, {
                when: dayLabel(b.schedules[0].date, true),
              }),
            )}
          </div>
        </section>
      )}

      <ListToolbar>
        <Stepper
          label={weekLabel}
          onPrev={() => goWeek(-1)}
          onNext={() => goWeek(1)}
          fill
        />
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-9 w-auto max-w-64 min-w-40 [&>span]:min-w-0 [&>span]:overflow-hidden">
            <SelectValue>
              <span className="truncate">
                {project === ALL
                  ? ti("sch_all_projects")
                  : projects.find(([id]) => id === project)?.[1]}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{ti("sch_all_projects")}</SelectItem>
            {projects.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={person} onValueChange={setPerson}>
          <SelectTrigger className="h-9 w-auto max-w-56 min-w-40 [&>span]:min-w-0 [&>span]:overflow-hidden">
            <SelectValue>
              <span className="truncate">
                {person === ALL
                  ? ti("sch_all_people")
                  : person === NONE
                    ? ti("sch_unassigned")
                    : peopleOptions.find(([id]) => id === person)?.[1]}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{ti("sch_all_people")}</SelectItem>
            <SelectItem value={NONE}>{ti("sch_unassigned")}</SelectItem>
            {peopleOptions.map(([id, name]) => (
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
        {unassigned.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() =>
              setAssign({
                title: weekLabel,
                schedules: unassigned,
                prefer: prefer(unassigned),
                withNote: false,
              })
            }
          >
            <UserRound className="size-3.5" />
            {ti("sch_assign_n", { n: unassigned.length })}
          </Button>
        )}
        {clearable.length > 0 && (
          <ConfirmButton
            className={unassigned.length > 0 ? undefined : "ml-auto"}
            icon={Eraser}
            label={ti("sch_clear_n", { n: clearable.length })}
            confirmLabel={ti("sch_clear_q", { n: clearable.length })}
            onConfirm={() => void remove(clearable.map((s) => s.itemId))}
          />
        )}
      </ListToolbar>
      {defaultPerson && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {ti("sch_auto_person", { name: defaultPerson.name })}
        </p>
      )}

      <div
        className={cn(
          "grid gap-3 2xl:grid-cols-[17rem_minmax(0,1fr)]",
          isPending && "opacity-70 transition-opacity",
        )}
      >
        {/* La bandeja: arriba o, en pantallas muy anchas, al lado. */}
        <aside className="flex min-w-0 flex-col gap-2 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:self-start 2xl:overflow-y-auto">
          <button
            type="button"
            onClick={() => setTrayOpen((o) => !o)}
            className="flex items-center justify-between gap-2 px-1 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {ti("sch_mobile_tray", { n: trayItems.length })}
              </span>
              <span className="block text-xs text-muted-foreground">
                {ti("sch_tray_hint")}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                trayOpen && "rotate-180",
              )}
            />
          </button>
          {(trayOpen || dragging?.scheduled) && (
            <div className="max-h-[22rem] overflow-y-auto 2xl:max-h-none">
              <Tray
                items={trayItems}
                expandAll={project !== ALL}
                colorOf={colorOf}
                pick={pick}
                dragging={dragging}
                onPick={setPick}
                onDragStart={startDrag}
                onDragEnd={endDrag}
                onDropRemove={() => {
                  const p = dragRef.current;
                  endDrag();
                  if (p?.scheduled) void remove(p.itemIds);
                }}
              />
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {/* Celular: un día a la vez. */}
          <div className="flex flex-col gap-3 lg:hidden">
            <SegmentedFilter
              fill
              value={mobileDay}
              onChange={setMobileDay}
              options={days.map((day) => ({
                value: day,
                label: `${dayLabel(day)} (${inWeek.filter((s) => s.date === day).length})`,
              }))}
            />
            {dayColumn(mobileDay, true)}
          </div>
          {/* Computadora: la semana en 6 columnas. */}
          <div className="hidden gap-2 lg:grid lg:grid-cols-6 xl:gap-3">
            {days.map((day) => dayColumn(day, false))}
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <SectionHeader
          title={ti("sch_compliance_title")}
          subtitle={ti("sch_compliance_hint")}
        />
        {comp.length === 0 ? (
          <EmptyState className="py-6">{ti("sch_compliance_empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col rounded-lg border border-border bg-card">
            {comp.map((c) => (
              <li
                key={c.personId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3.5 py-2.5 last:border-0"
              >
                <span className="min-w-36 flex-1 text-sm font-medium text-foreground">
                  {c.personName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.onTime} {ti("sch_on_time")} · {c.late} {ti("sch_late")} ·{" "}
                  {c.missed} {ti("sch_missed")}
                </span>
                <span className="flex w-36 items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.round((c.rate ?? 0) * 100)}%`,
                        backgroundColor:
                          (c.rate ?? 0) >= 0.8
                            ? "var(--success)"
                            : (c.rate ?? 0) >= 0.5
                              ? "var(--warning)"
                              : "var(--destructive)",
                      }}
                    />
                  </span>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">
                    {c.rate == null ? "—" : `${Math.round(c.rate * 100)}%`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lo elegido con un toque: se pone en un día con otro toque (igual en celular y computadora). */}
      {pick && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-2xl lg:rounded-xl lg:border">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {ti("sch_picked", { label: pick.label })} ·{" "}
              <span className="text-muted-foreground">
                {ti("sch_n_items", { n: pick.itemIds.length })}
              </span>
            </p>
            {pick.scheduled && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => void remove(pick.itemIds)}
              >
                {ti("sch_unschedule")}
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setPick(null)}
              aria-label={ti("cancel")}
              title={ti("cancel")}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto lg:hidden">
            <span className="shrink-0 text-xs text-muted-foreground">
              {ti("sch_place_in")}
            </span>
            {days.map((day) => (
              <Button
                key={day}
                size="sm"
                variant={day === today ? "default" : "outline"}
                className="shrink-0 capitalize"
                onClick={() => void place(pick, day, null)}
              >
                {dayLabel(day)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <AssignDialog
        request={assign}
        people={board.people}
        onClose={() => setAssign(null)}
        onDone={() => {
          setAssign(null);
          refresh();
        }}
      />
      <BlockDetailDialog
        block={detail}
        items={itemById}
        today={today}
        onClose={() => setDetail(null)}
      />
      <PlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        days={days}
        schedules={board.schedules}
        items={itemById}
        defaultProject={project !== ALL ? project : null}
        defaultPerson={person !== ALL && person !== NONE ? person : null}
      />
    </div>
  );
}
