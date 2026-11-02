"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  GripVertical,
  Maximize2,
  AlignLeft,
  ListOrdered,
  UserRound,
  X,
} from "lucide-react";

import type {
  InspectionPhoto,
  InspectionSchedule,
  ScheduleItem,
  SchedulePerson,
} from "@/types/inspections";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
import { PhotoViewer, useTi } from "../shared";
import { PersonOptions } from "./assign-dialog";

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
  const url = item?.photos[0]?.thumb ?? item?.photos[0]?.url;
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
  colorOf,
  pick,
  dragging,
  onPick,
  onDragStart,
  onDragEnd,
  onDropRemove,
}: {
  items: ScheduleItem[];
  expandAll: boolean;
  /** Color de cada obra (el mismo de sus tarjetas en la semana). */
  colorOf: (projectId: string) => string;
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
                  "flex cursor-grab items-center gap-2 rounded-md border-l-[3px] bg-muted/50 px-2 py-1.5 text-left active:cursor-grabbing",
                  pick?.key === pKey && "bg-primary/10 ring-2 ring-primary",
                )}
                style={{ borderLeftColor: colorOf(projectId) }}
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
                                    {it.piece && (
                                      <span className="font-semibold">
                                        {it.piece}:{" "}
                                      </span>
                                    )}
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

/** Computadora (≥ lg): ahí se arrastra, así que los menús no repiten subir / bajar / mover. */
export function useIsDesktop() {
  return React.useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

const NONE = "none";

/** Iniciales de un nombre: "Wilfredo Mendoza" → "WM". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Color estable por persona (de la misma paleta que las obras). */
const personColor = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `var(--project-${(h % 8) + 1})`;
};

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-background ring-2 ring-card", className)}
      style={{ backgroundColor: personColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

/** Botón cuadrado de la tarjeta (como en ClickUp); no arrastra ni elige la tarjeta. */
const squareBtn = "flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5";

/** Quién atiende, directo en la tarjeta: el avatar (o un círculo punteado si nadie); un toque abre la lista. */
function PersonPicker({
  schedules,
  people,
  prefer,
  onChange,
}: {
  schedules: InspectionSchedule[];
  people: SchedulePerson[];
  prefer: "pintor" | "ebanista" | null;
  onChange: (person: { kind: "empleado" | "contratista"; id: string } | null) => void;
}) {
  const { ti } = useTi();
  const { names, unassigned } = blockPeople(schedules);
  const ids = [...new Set(schedules.map((s) => (s.personId ? `${s.personKind}:${s.personId}` : NONE)))];
  const value = ids.length === 1 ? ids[0] : "";
  const title = names.length === 0 ? ti("sch_unassigned") : `${names.join(", ")}${unassigned ? ` · ${ti("sch_unassigned")} (${unassigned})` : ""}`;
  return (
    <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} className="flex">
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === NONE) return onChange(null);
          const [kind, id] = v.split(":");
          onChange({ kind: kind === "empleado" ? "empleado" : "contratista", id });
        }}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            "h-7 w-auto min-w-0 gap-0 rounded-md p-0 shadow-none data-[size=sm]:h-7 [&>svg:last-child]:hidden",
            names.length === 0 ? "size-7 justify-center border-dashed text-muted-foreground hover:bg-muted" : "border-transparent bg-transparent px-0.5",
          )}
          aria-label={`${ti("sch_person")}: ${title}`}
          title={title}
        >
          {names.length === 0 ? (
            <UserRound className="size-3.5" />
          ) : (
            <span className="flex -space-x-1.5">
              {names.slice(0, 2).map((n) => (
                <Avatar key={n} name={n} />
              ))}
              {names.length > 2 && <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">+{names.length - 2}</span>}
            </span>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{ti("sch_no_person")}</SelectItem>
          <PersonOptions people={people} prefer={prefer} />
        </SelectContent>
      </Select>
    </span>
  );
}

/** Botón de la tarjeta (no inicia arrastre ni elige la tarjeta). */
function CardIcon({
  label,
  onClick,
  children,
  active,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      draggable={false}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(className ?? squareBtn, active && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary")}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/**
 * Un área (de una obra) en un día, como tarjeta: la obra (en su color), el
 * área, cuántos detalles y el estado, las fotos y, abajo, botones cuadrados:
 * quién la atiende (avatar), la nota (rayitas) y sus detalles. "Ver en
 * grande" y el menú flotan arriba a la derecha al pasar el mouse (en el
 * celular quedan abajo). En computadora se arrastra; en el celular, el menú
 * sube, baja o mueve.
 */
export function BlockCard({
  block,
  items,
  today,
  showProject,
  when,
  pick,
  dropActive,
  people,
  prefer,
  color,
  onPick,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onMove,
  onPerson,
  onNote,
  onOpen,
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
  people: SchedulePerson[];
  prefer: "pintor" | "ebanista" | null;
  /** Color de la obra (borde de la tarjeta). */
  color: string;
  onPick: (p: Pick | null) => void;
  onDragStart: (p: Pick) => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
  onMove?: (dir: -1 | 1) => void;
  onPerson: (person: { kind: "empleado" | "contratista"; id: string } | null) => void;
  onNote: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onItemMove: (s: InspectionSchedule, dir: -1 | 1) => void;
  onItemRemove: (s: InspectionSchedule) => void;
}) {
  const { ti } = useTi();
  const desktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const first = items.get(block.schedules[0].itemId);
  const state = blockState(block.schedules, today);
  const openOnes = block.schedules.filter((s) => s.outcome === "programado");
  const done = block.schedules.length - openOnes.length;
  const notes = [...new Set(block.schedules.map((s) => s.note).filter(Boolean))];
  const areaName = block.area ?? ti("no_area");
  const bPick: Pick = { key: `b|${block.key}|${block.schedules[0].date}`, label: `${areaName} · ${first?.projectName ?? ""}`, itemIds: openOnes.map((s) => s.itemId), scheduled: true };
  const movable = openOnes.length > 0;

  const menu = movable ? (
    <RowMenu
      label={ti("sch_unschedule")}
      items={[
        ...(!desktop && onMove
          ? [
              { label: ti("sch_up"), icon: ArrowUp, onSelect: () => onMove(-1) },
              { label: ti("sch_down"), icon: ArrowDown, onSelect: () => onMove(1) },
            ]
          : []),
        ...(!desktop || when ? [{ label: ti("sch_move_day"), icon: CalendarClock, onSelect: () => onPick(bPick) }] : []),
        { label: ti("sch_remove_all"), icon: X, onSelect: onRemove, confirmLabel: ti("sch_remove_all_q") },
      ]}
    />
  ) : null;

  return (
    <div
      {...(movable ? pickable(bPick, pick, onPick, onDragStart, onDragEnd) : {})}
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
        "group relative flex min-w-0 flex-col gap-2 rounded-xl border border-l-[3px] border-border bg-card px-3 py-2.5 text-left shadow-xs transition-shadow hover:shadow-sm",
        movable && "cursor-grab active:cursor-grabbing",
        pick?.key === bPick.key && "ring-2 ring-primary",
        over && "before:absolute before:inset-x-0 before:-top-1.5 before:h-1 before:rounded-full before:bg-primary",
      )}
      style={{ borderLeftColor: color }}
    >
      {/* Acciones flotantes (computadora): aparecen al pasar el mouse, como en ClickUp. */}
      {desktop && (
        <span
          className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <CardIcon label={ti("sch_open_big")} onClick={onOpen} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5">
            <Maximize2 />
          </CardIcon>
          {menu}
        </span>
      )}

      <div className="min-w-0">
        {when && <span className="block text-[11px] font-medium capitalize text-destructive">{when}</span>}
        {showProject && (
          <span className="block truncate text-[11px] font-medium" style={{ color }}>
            {first?.projectName ?? "—"}
          </span>
        )}
        <span className="block text-[15px] leading-snug font-semibold break-words text-foreground">{areaName}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            {ti("sch_n_items", { n: block.schedules.length })}
            {done > 0 && state !== "hecho" && ` · ${ti("sch_done_of", { done, n: block.schedules.length })}`}
          </span>
          {state !== "programado" && (
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] leading-none font-medium"
              style={{ color: STATE_COLOR[state], backgroundColor: `color-mix(in oklch, ${STATE_COLOR[state]} 12%, transparent)` }}
            >
              {ti(state === "hecho" ? "sch_state_hecho" : "sch_state_vencido")}
            </span>
          )}
        </span>
        {notes.length > 0 && <span className="mt-1 line-clamp-2 block text-[11px] break-words text-muted-foreground italic">{notes.join(" · ")}</span>}
      </div>

      <button
        type="button"
        draggable={false}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="min-w-0 self-start overflow-hidden rounded"
        aria-label={ti("sch_open_big")}
        title={ti("sch_open_big")}
      >
        <ThumbStrip items={block.schedules.map((s) => items.get(s.itemId))} max={4} size="size-8" />
      </button>

      {/* Abajo: botones cuadrados (persona, nota, detalles) como en ClickUp. */}
      <span className="flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {movable ? (
          <PersonPicker schedules={openOnes} people={people} prefer={prefer} onChange={onPerson} />
        ) : (
          <span className="flex -space-x-1.5">
            {blockPeople(block.schedules).names.map((n) => (
              <span key={n} title={n}>
                <Avatar name={n} />
              </span>
            ))}
          </span>
        )}
        {movable && (
          <CardIcon label={notes.length ? `${ti("sch_note")}: ${notes.join(" · ")}` : ti("sch_note")} onClick={onNote} active={notes.length > 0}>
            <AlignLeft />
          </CardIcon>
        )}
        <CardIcon label={open ? ti("sch_hide_items") : ti("sch_show_items")} onClick={() => setOpen((o) => !o)} active={open}>
          <ListOrdered />
        </CardIcon>
        {!desktop && (
          <span className="ml-auto flex items-center">
            <CardIcon label={ti("sch_open_big")} onClick={onOpen}>
              <Maximize2 />
            </CardIcon>
            {menu}
          </span>
        )}
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
                  "flex min-w-0 items-start gap-1.5 rounded px-0.5 py-0.5",
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
                <span className="line-clamp-3 min-w-0 flex-1 text-[11.5px] leading-snug break-words text-foreground">
                  {it?.piece && (
                    <span className="font-semibold">{it.piece}: </span>
                  )}
                  {it?.comment || ti("no_comment")}
                </span>
                {isOpen && (
                  <span
                    className="-my-1 -mr-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu
                      label={ti("sch_unschedule")}
                      items={[
                        ...(!desktop
                          ? [
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
                            ]
                          : []),
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

/** Los detalles de un bloque en grande: fotos de antes, qué hacer y su estado; un toque en la foto la amplía. */
export function BlockDetailDialog({
  block,
  items,
  today,
  onClose,
}: {
  block: DayBlock | null;
  items: ReadonlyMap<string, ScheduleItem>;
  today: string;
  onClose: () => void;
}) {
  const { ti } = useTi();
  const [viewer, setViewer] = React.useState<{
    photos: InspectionPhoto[];
    index: number;
  } | null>(null);
  const first = block ? items.get(block.schedules[0].itemId) : undefined;
  return (
    <>
      <Dialog open={block !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{block?.area ?? ti("no_area")}</DialogTitle>
            <DialogDescription>
              {first?.projectName}
              {first?.location ? ` · ${first.location}` : ""} ·{" "}
              {ti("sch_n_items", { n: block?.schedules.length ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3">
            {block?.schedules.map((s, k) => {
              const it = items.get(s.itemId);
              const st = scheduleState(s, today);
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border border-l-[3px] border-border p-3"
                  style={{ borderLeftColor: STATE_COLOR[st] }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-background tabular-nums"
                      style={{ backgroundColor: STATE_COLOR[st] }}
                    >
                      {k + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm break-words text-foreground">
                        {it?.piece && (
                          <span className="font-semibold">{it.piece}: </span>
                        )}
                        {it?.comment || ti("no_comment")}
                      </span>
                      {it && (
                        <DetailTags
                          item={{ ...it, painterName: null }}
                          className="mt-1"
                        />
                      )}
                      {s.note && (
                        <span className="mt-1 block text-xs text-muted-foreground italic">
                          {s.note}
                        </span>
                      )}
                    </span>
                  </div>
                  {it && it.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {it.photos.map((ph, j) => (
                        <button
                          key={ph.id}
                          type="button"
                          onClick={() =>
                            setViewer({ photos: it.photos, index: j })
                          }
                          className="overflow-hidden rounded-md"
                        >
                          {ph.thumb ?? ph.url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- foto firmada del detalle.
                            <img
                              src={ph.thumb ?? ph.url ?? undefined}
                              alt=""
                              loading="lazy"
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <span className="block aspect-square w-full bg-muted" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {first && (
            <Button asChild variant="outline" className="self-start">
              <Link href={inspectionsPath(first.projectId)}>
                <ExternalLink className="size-4" />
                {ti("sch_open_item")}
              </Link>
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <PhotoViewer
        photos={viewer?.photos ?? []}
        index={viewer?.index ?? null}
        onIndex={(i) =>
          setViewer((v) => (v && i !== null ? { ...v, index: i } : null))
        }
      />
    </>
  );
}
