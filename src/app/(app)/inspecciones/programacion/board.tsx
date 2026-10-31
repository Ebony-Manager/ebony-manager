"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  GripVertical,
  UserRound,
  X,
} from "lucide-react";

import type { InspectionSchedule, ScheduleItem } from "@/types/inspections";
import { RowMenu } from "@/components/shared/row-menu";
import {
  blockPeople,
  blockState,
  groupByArea,
  scheduleState,
  type DayBlock,
  type ScheduleState,
} from "@/lib/inspections/schedule";
import { cn } from "@/lib/utils";
import { DetailTags } from "../detail-fields";
import { inspectionsPath } from "../paths";
import { useTi } from "../shared";

/** Lo que se está moviendo (arrastrando o elegido con un toque): una obra, un área, un bloque o un detalle. */
export interface Pick {
  key: string;
  label: string;
  itemIds: string[];
  /** Ya programado (se mueve de día o se quita); si no, viene de la bandeja. */
  scheduled: boolean;
}

/** Color del borde y del estado (los del tema). */
export const STATE_COLOR: Record<ScheduleState, string> = {
  programado: "var(--primary)",
  hecho: "var(--success)",
  vencido: "var(--destructive)",
};

function Thumb({
  item,
  className,
}: {
  item: ScheduleItem | undefined;
  className?: string;
}) {
  const url = item?.photos[0]?.url;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto firmada del detalle.
    <img
      src={url}
      alt=""
      loading="lazy"
      draggable={false}
      className={cn("shrink-0 rounded object-cover", className)}
    />
  ) : (
    <span className={cn("shrink-0 rounded bg-muted", className)} />
  );
}

/** Hasta `max` fotos en fila, con "+n" si hay más. */
function ThumbStrip({
  items,
  max = 5,
  size = "size-8",
}: {
  items: (ScheduleItem | undefined)[];
  max?: number;
  size?: string;
}) {
  const shown = items.slice(0, max);
  return (
    <span className="flex min-w-0 items-center gap-1">
      {shown.map((it, i) => (
        <Thumb key={it?.id ?? i} item={it} className={size} />
      ))}
      {items.length > max && (
        <span className="text-[11px] font-medium text-muted-foreground">
          +{items.length - max}
        </span>
      )}
    </span>
  );
}

/** Propiedades comunes para algo que se arrastra o se elige con un toque. */
function pickable(
  pick: Pick,
  current: Pick | null,
  onPick: (p: Pick | null) => void,
  onDragStart: (p: Pick) => void,
  onDragEnd: () => void,
) {
  return {
    role: "button" as const,
    tabIndex: 0,
    draggable: true,
    "aria-pressed": current?.key === pick.key,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onPick(current?.key === pick.key ? null : pick);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(current?.key === pick.key ? null : pick);
      }
    },
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", pick.label);
      onDragStart(pick);
    },
    onDragEnd,
  };
}

/**
 * La bandeja: lo pendiente sin programar por obra → área → detalle. Cualquiera
 * de los tres se arrastra a un día (o se toca y se elige el día). Soltar aquí
 * algo ya programado lo quita de la programación.
 */
export function Tray({
  items,
  expandAll,
  pick,
  dragging,
  onPick,
  onDragStart,
  onDragEnd,
  onDropRemove,
}: {
  items: ScheduleItem[];
  expandAll: boolean;
  pick: Pick | null;
  dragging: Pick | null;
  onPick: (p: Pick | null) => void;
  onDragStart: (p: Pick) => void;
  onDragEnd: () => void;
  onDropRemove: () => void;
}) {
  const { ti } = useTi();
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [over, setOver] = React.useState(false);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const areas = groupByArea(items);
  const projects = [
    ...new Map(areas.map((a) => [a.projectId, a.projectName])).entries(),
  ];
  const removing = dragging?.scheduled;
  const isOpen = (key: string, byDefault: boolean) =>
    open.has(key) ? !byDefault : byDefault;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-2",
        removing && "border-dashed border-destructive/60",
        over && removing && "bg-destructive/5",
      )}
      onDragOver={(e) => {
        if (!removing) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (removing) onDropRemove();
      }}
    >
      {removing ? (
        <p className="px-1 py-6 text-center text-xs font-medium text-destructive">
          {ti("sch_drop_remove")}
        </p>
      ) : items.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          {ti("sch_tray_empty")}
        </p>
      ) : (
        projects.map(([projectId, projectName]) => {
          const projectAreas = areas.filter((a) => a.projectId === projectId);
          const projectItems = projectAreas.flatMap((a) => a.items);
          const pKey = `p|${projectId}`;
          const pPick: Pick = {
            key: pKey,
            label: projectName,
            itemIds: projectItems.map((i) => i.id),
            scheduled: false,
          };
          const pOpen = isOpen(pKey, expandAll || projects.length === 1);
          return (
            <div key={projectId} className="flex flex-col gap-1">
              <div
                {...pickable(pPick, pick, onPick, onDragStart, onDragEnd)}
                className={cn(
                  "flex cursor-grab items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-left active:cursor-grabbing",
                  pick?.key === pKey && "bg-primary/10 ring-2 ring-primary",
                )}
              >
                <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {projectName}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {ti("sch_whole_project")} ·{" "}
                    {ti("sch_n_items", { n: projectItems.length })}
                  </span>
                </span>
                <ExpandButton open={pOpen} onClick={() => toggle(pKey)} />
              </div>
              {pOpen && (
                <div className="ml-3 grid items-start gap-1.5 border-l border-border pl-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1">
                  {projectAreas.map((a) => {
                    const aPick: Pick = {
                      key: `a|${a.key}`,
                      label: `${a.area ?? ti("no_area")} · ${projectName}`,
                      itemIds: a.items.map((i) => i.id),
                      scheduled: false,
                    };
                    const aOpen = isOpen(aPick.key, false);
                    return (
                      <div key={a.key} className="flex min-w-0 flex-col gap-1">
                        <div
                          {...pickable(
                            aPick,
                            pick,
                            onPick,
                            onDragStart,
                            onDragEnd,
                          )}
                          className={cn(
                            "flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left active:cursor-grabbing",
                            pick?.key === aPick.key &&
                              "border-primary bg-primary/10 ring-2 ring-primary",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="truncate text-sm font-medium text-foreground">
                                {a.area ?? ti("no_area")}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {a.items.length}
                              </span>
                            </span>
                            <span className="mt-1 block">
                              <ThumbStrip items={a.items} max={4} />
                            </span>
                          </span>
                          <ExpandButton
                            open={aOpen}
                            onClick={() => toggle(aPick.key)}
                          />
                        </div>
                        {aOpen &&
                          a.items.map((it) => {
                            const iPick: Pick = {
                              key: `i|${it.id}`,
                              label: it.comment || (a.area ?? ti("no_area")),
                              itemIds: [it.id],
                              scheduled: false,
                            };
                            return (
                              <div
                                key={it.id}
                                {...pickable(
                                  iPick,
                                  pick,
                                  onPick,
                                  onDragStart,
                                  onDragEnd,
                                )}
                                className={cn(
                                  "ml-2 flex cursor-grab items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/40 active:cursor-grabbing",
                                  pick?.key === iPick.key &&
                                    "bg-primary/10 ring-2 ring-primary",
                                )}
                              >
                                <Thumb item={it} className="size-9" />
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-2 text-xs text-foreground">
                                    {it.comment || ti("no_comment")}
                                  </span>
                                  <DetailTags
                                    item={{ ...it, painterName: null }}
                                    className="mt-0.5"
                                  />
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ExpandButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  const { ti } = useTi();
  return (
    <button
      type="button"
      draggable={false}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={open ? ti("sch_hide_items") : ti("sch_show_items")}
      title={open ? ti("sch_hide_items") : ti("sch_show_items")}
    >
      <ChevronDown
        className={cn("size-4 transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

/**
 * Un área (de una obra) en un día: nombre, cuántos detalles y cuántos hechos,
 * quién lo atiende, la nota, las fotos y el estado al borde. Se arrastra a
 * otro día o antes de otro bloque; abierto, muestra sus detalles en orden.
 */
export function BlockCard({
  block,
  items,
  today,
  showProject,
  when,
  pick,
  dropActive,
  onPick,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onMove,
  onAssign,
  onRemove,
  onItemMove,
  onItemRemove,
}: {
  block: DayBlock;
  items: ReadonlyMap<string, ScheduleItem>;
  today: string;
  showProject: boolean;
  /** Para los vencidos: el día que tenía. */
  when?: string;
  pick: Pick | null;
  dropActive: boolean;
  onPick: (p: Pick | null) => void;
  onDragStart: (p: Pick) => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
  onMove?: (dir: -1 | 1) => void;
  onAssign: () => void;
  onRemove: () => void;
  onItemMove: (s: InspectionSchedule, dir: -1 | 1) => void;
  onItemRemove: (s: InspectionSchedule) => void;
}) {
  const { ti } = useTi();
  const [open, setOpen] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const first = items.get(block.schedules[0].itemId);
  const state = blockState(block.schedules, today);
  const openOnes = block.schedules.filter((s) => s.outcome === "programado");
  const done = block.schedules.length - openOnes.length;
  const { names, unassigned } = blockPeople(block.schedules);
  const notes = [
    ...new Set(block.schedules.map((s) => s.note).filter(Boolean)),
  ];
  const areaName = block.area ?? ti("no_area");
  const bPick: Pick = {
    key: `b|${block.key}|${block.schedules[0].date}`,
    label: `${areaName} · ${first?.projectName ?? ""}`,
    itemIds: openOnes.map((s) => s.itemId),
    scheduled: true,
  };
  const movable = openOnes.length > 0;

  return (
    <div
      {...(movable
        ? pickable(bPick, pick, onPick, onDragStart, onDragEnd)
        : {})}
      onDragOver={(e) => {
        if (!dropActive) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!dropActive) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDropBefore();
      }}
      className={cn(
        "relative flex flex-col gap-1.5 rounded-lg border border-l-[3px] border-border bg-card px-2.5 py-2 text-left",
        movable && "cursor-grab active:cursor-grabbing",
        pick?.key === bPick.key && "ring-2 ring-primary",
        over &&
          "before:absolute before:inset-x-0 before:-top-1.5 before:h-1 before:rounded-full before:bg-primary",
      )}
      style={{ borderLeftColor: STATE_COLOR[state] }}
    >
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1">
          {when && (
            <span className="block text-[11px] font-medium capitalize text-destructive">
              {when}
            </span>
          )}
          {showProject && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {first?.projectName ?? "—"}
            </span>
          )}
          <span className="block text-sm leading-snug font-semibold text-foreground">
            {areaName}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {ti("sch_n_items", { n: block.schedules.length })}
            {done > 0 &&
              ` · ${ti("sch_done_of", { done, n: block.schedules.length })}`}
          </span>
        </span>
        <span className="-mt-1 -mr-1.5" onClick={(e) => e.stopPropagation()}>
          <RowMenu
            label={ti("sch_assign")}
            items={[
              ...(onMove && movable
                ? [
                    {
                      label: ti("sch_up"),
                      icon: ArrowUp,
                      onSelect: () => onMove(-1),
                    },
                    {
                      label: ti("sch_down"),
                      icon: ArrowDown,
                      onSelect: () => onMove(1),
                    },
                  ]
                : []),
              ...(movable
                ? [
                    {
                      label: ti("sch_assign"),
                      icon: UserRound,
                      onSelect: onAssign,
                    },
                    {
                      label: ti("sch_move_day"),
                      icon: CalendarClock,
                      onSelect: () => onPick(bPick),
                    },
                  ]
                : []),
              ...(first
                ? [
                    {
                      label: ti("sch_open_item"),
                      icon: ExternalLink,
                      onSelect: () =>
                        window.location.assign(
                          inspectionsPath(first.projectId),
                        ),
                    },
                  ]
                : []),
              ...(movable
                ? [
                    {
                      label: ti("sch_remove_all"),
                      icon: X,
                      onSelect: onRemove,
                      confirmLabel: ti("sch_remove_all_q"),
                    },
                  ]
                : []),
            ]}
          />
        </span>
      </div>
      <span className="flex flex-wrap items-center gap-1">
        {names.map((n) => (
          <span
            key={n}
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-foreground"
          >
            <UserRound className="size-3" />
            {n}
          </span>
        ))}
        {unassigned > 0 && (
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
            className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-warning hover:bg-warning/25"
          >
            <UserRound className="size-3" />
            {ti("sch_unassigned")}
            {names.length > 0 && ` (${unassigned})`}
          </button>
        )}
      </span>
      {notes.map((n) => (
        <span key={n} className="text-[11px] text-muted-foreground italic">
          {n}
        </span>
      ))}
      <span className="flex min-w-0 items-center justify-between gap-1">
        <ThumbStrip
          items={block.schedules.map((s) => items.get(s.itemId))}
          max={3}
          size="size-7"
        />
        <ExpandButton open={open} onClick={() => setOpen((o) => !o)} />
      </span>
      {open && (
        <ol
          className="flex flex-col gap-1 border-t border-border pt-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {block.schedules.map((s, k) => {
            const it = items.get(s.itemId);
            const st = scheduleState(s, today);
            const sPick: Pick = {
              key: `s|${s.id}`,
              label: it?.comment || areaName,
              itemIds: [s.itemId],
              scheduled: true,
            };
            const isOpen = s.outcome === "programado";
            return (
              <li
                key={s.id}
                {...(isOpen
                  ? pickable(sPick, pick, onPick, onDragStart, onDragEnd)
                  : {})}
                className={cn(
                  "flex items-start gap-1.5 rounded px-0.5 py-0.5",
                  isOpen && "cursor-grab",
                  pick?.key === sPick.key &&
                    "bg-primary/10 ring-2 ring-primary",
                )}
              >
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-background tabular-nums"
                  style={{ backgroundColor: STATE_COLOR[st] }}
                >
                  {k + 1}
                </span>
                <Thumb item={it} className="size-8" />
                <span className="line-clamp-3 min-w-0 flex-1 text-[11.5px] leading-snug text-foreground">
                  {it?.comment || ti("no_comment")}
                </span>
                {isOpen && (
                  <span
                    className="-my-1 -mr-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu
                      label={ti("sch_reschedule")}
                      items={[
                        {
                          label: ti("sch_up"),
                          icon: ArrowUp,
                          onSelect: () => onItemMove(s, -1),
                          disabled: k === 0,
                        },
                        {
                          label: ti("sch_down"),
                          icon: ArrowDown,
                          onSelect: () => onItemMove(s, 1),
                          disabled: k === block.schedules.length - 1,
                        },
                        {
                          label: ti("sch_move_day"),
                          icon: CalendarClock,
                          onSelect: () => onPick(sPick),
                        },
                        {
                          label: ti("sch_unschedule"),
                          icon: X,
                          onSelect: () => onItemRemove(s),
                          confirmLabel: ti("sch_unschedule_q"),
                        },
                      ]}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
