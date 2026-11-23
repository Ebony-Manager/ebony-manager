"use client";

import * as React from "react";
import { Palette, UserCheck } from "lucide-react";

import { EmptyState, PAGE_CLASS, PageHeader, SubTabs } from "@/components/shared/page-header";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import { projectPath } from "@/app/(app)/proyectos/paths";
import Link from "next/link";
import { Factory } from "lucide-react";
import { DESIGN_STAGES, STAGE_LATE_DAYS, type BoardItem, type ItemStage } from "@/types/diseno";
import { DESIGN_ORDER_STATUSES, type OrderSummary } from "@/types/produccion";
import { orderMissing } from "@/lib/produccion/missing";
import { OrderStatusBadge, itemsLabel, missingText, useTo } from "./orden/shared";
import { orderPath } from "./orden/paths";
import { StageGroupDialog } from "./stage-panel";
import { STAGE_STEP } from "@/lib/diseno/steps";
import { Button } from "@/components/ui/button";
import { daysInStage, daysLabel, designerName, isLate, stageLabel, useTd } from "./shared";
import { ItemDialog } from "./item-dialog";

type Scope = "mine" | "all";
const ALL = "__all__";

type ProjectTab = { id: string; name: string; count: number; late: boolean; oldest: string };

type Card = { projectId: string; projectName: string; stageSince: string; late: boolean };

/** Los proyectos de una lista de tarjetas: los que tienen algo atrasado primero; después, el que espera hace más tiempo. */
function projectsOf(items: Card[]): ProjectTab[] {
  const map = new Map<string, ProjectTab>();
  for (const i of items) {
    const p = map.get(i.projectId) ?? { id: i.projectId, name: i.projectName, count: 0, late: false, oldest: i.stageSince };
    p.count += 1;
    p.late ||= i.late;
    if (i.stageSince < p.oldest) p.oldest = i.stageSince;
    map.set(i.projectId, p);
  }
  return [...map.values()].sort((a, b) => Number(b.late) - Number(a.late) || a.oldest.localeCompare(b.oldest) || a.name.localeCompare(b.name));
}

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{n}</span>;
}
const SCOPE_KEY = "diseno.scope";

function readScope(): Scope | null {
  try {
    const v = window.localStorage.getItem(SCOPE_KEY);
    return v === "mine" || v === "all" ? v : null;
  } catch {
    return null;
  }
}
function saveScope(v: Scope) {
  try {
    window.localStorage.setItem(SCOPE_KEY, v);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/**
 * Diseño: los ítems en columnas por etapa (Por medir → En diseño → Con el cliente → Aprobado). Cada diseñadora ve
 * sus proyectos; gerencia ve todos. Lo que lleva más de 7 días en la misma etapa sale en rojo y arriba.
 */
type Column = ItemStage | "orders";
const COLUMNS: readonly Column[] = [...DESIGN_STAGES, "orders"];
const ORDER_LATE_DAYS = STAGE_LATE_DAYS;

export function DesignBoard({
  items: allItems,
  orders: allOrders,
  myProjectIds,
  myEmployeeId,
}: {
  items: BoardItem[];
  /** Las órdenes de producción de los proyectos activos (todas: para saber qué ítems ya tienen orden). */
  orders: OrderSummary[];
  myProjectIds: string[];
  myEmployeeId: string | null;
}) {
  const { td } = useTd();
  const { lang, to } = useTo();
  // Un ítem que ya entró en una orden sale de su columna: se ve dentro de la tarjeta de su orden.
  const taken = new Set(allOrders.flatMap((o) => o.itemIds));
  const items = allItems.filter((i) => !taken.has(i.id));
  const designOrders = allOrders.filter((o) => DESIGN_ORDER_STATUSES.includes(o.status));
  const hasMine = myProjectIds.length > 0 || (!!myEmployeeId && items.some((i) => i.designerId === myEmployeeId));
  const [scope, setScope] = React.useState<Scope>(hasMine ? "mine" : "all");
  const [column, setColumn] = React.useState<Column>("por_medir");
  const [openId, setOpenId] = React.useState<string | null>(null);
  // El documento de la etapa para varios ítems de un proyecto a la vez (desde el encabezado del grupo).
  const [groupFor, setGroupFor] = React.useState<{ ids: string[]; title: string } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- se lee el navegador una vez al abrir. */
  React.useEffect(() => {
    const saved = readScope();
    if (saved && (saved === "all" || hasMine)) setScope(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mine = React.useMemo(() => new Set(myProjectIds), [myProjectIds]);
  // Mis ítems: los asignados a mí y, de mis proyectos, los que nadie tiene todavía (para que no se pierdan).
  const isMine = (i: BoardItem) => (myEmployeeId && i.designerId === myEmployeeId) || (!i.designerId && mine.has(i.projectId));
  const inScope = scope === "mine" ? items.filter(isMine) : items;
  // Mis órdenes: las de mis proyectos o las que llevan ítems míos.
  const ordersInScope =
    scope === "mine" ? designOrders.filter((o) => mine.has(o.projectId) || o.itemIds.some((id) => allItems.find((i) => i.id === id)?.designerId === myEmployeeId)) : designOrders;
  const orderLate = (o: OrderSummary) => daysInStage({ stageSince: o.statusSince }) > ORDER_LATE_DAYS;
  const cards: Card[] = [
    ...inScope.map((i) => ({ projectId: i.projectId, projectName: i.projectName, stageSince: i.stageSince, late: isLate(i) })),
    ...ordersInScope.map((o) => ({ projectId: o.projectId, projectName: o.projectName, stageSince: o.statusSince, late: orderLate(o) })),
  ];
  // Una pestaña por proyecto (los que tienen algo atrasado primero) para ver uno solo.
  const projects = projectsOf(cards);
  const [project, setProject] = React.useState<string>(ALL);
  const current = projects.some((p) => p.id === project) ? project : ALL;
  const shown = current === ALL ? inScope : inScope.filter((i) => i.projectId === current);
  const shownOrders = (current === ALL ? ordersInScope : ordersInScope.filter((o) => o.projectId === current)).sort(
    (a, b) => Number(orderLate(b)) - Number(orderLate(a)) || a.statusSince.localeCompare(b.statusSince),
  );
  const count = (c: Column) => (c === "orders" ? shownOrders.length : byStage(c).length);
  const grouped = current === ALL && projects.length > 1;
  const byStage = (s: ItemStage) =>
    shown
      .filter((i) => i.stage === s)
      // Lo atrasado arriba; después, lo que lleva más tiempo.
      .sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || a.stageSince.localeCompare(b.stageSince));

  const card = (i: BoardItem) => {
    const late = isLate(i);
    const where = grouped || current !== ALL ? i.area : [i.projectName, i.area].filter(Boolean).join(" · ");
    return (
      <li key={i.id}>
        <button
          type="button"
          onClick={() => setOpenId(i.id)}
          className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
        >
          <span className="text-sm font-medium text-foreground">{i.name}</span>
          {where && <span className="truncate text-xs text-muted-foreground">{where}</span>}
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className={late ? "font-medium text-destructive" : ""}>
              {late ? `${td("late")} · ` : ""}
              {daysLabel(td, daysInStage(i))}
            </span>
            {i.areaNotReady && <span>· {td("area_not_ready")}</span>}
            {(scope === "all" || !i.designerId) && i.designers.length > 0 && (
              <span className={`flex items-center gap-1 ${i.designerId ? "" : "font-medium text-foreground"}`}>
                · <ICON.designer className="size-3" />
                {designerName(td, i.designerId, i.designers)}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  const orderCard = (o: OrderSummary) => {
    const late = orderLate(o);
    const missing = orderMissing({ itemCount: o.itemIds.length, fileKinds: o.fileKinds, laborCount: o.laborCount });
    const editing = o.status !== "en_revision";
    return (
      <li key={o.id}>
        <Link href={orderPath(o.id)} className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40">
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{to("title", { n: o.number })}</span>
            <OrderStatusBadge status={o.status} to={to} />
          </span>
          {current === ALL && <span className="truncate text-xs text-muted-foreground">{o.projectName}</span>}
          <span className="text-xs text-muted-foreground">
            {itemsLabel(to, o.itemIds.length)}
            {o.colorsPending > 0 && ` · ${to("colors_pending", { n: o.colorsPending })}`}
          </span>
          {editing && missing.length > 0 && <span className="text-xs text-foreground">{to("missing", { list: missingText(to, missing, lang) })}</span>}
          <span className={`text-xs ${late ? "font-medium text-destructive" : "text-muted-foreground"}`}>
            {late ? `${td("late")} · ` : ""}
            {daysLabel(td, daysInStage({ stageSince: o.statusSince }))}
          </span>
        </Link>
      </li>
    );
  };

  const col = (s: Column) => {
    if (s === "orders")
      return (
        <div key={s} className="flex min-w-0 flex-col gap-2">
          <p className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground xl:flex">
            {to("column")} <span className="font-normal">({shownOrders.length})</span>
          </p>
          {shownOrders.length === 0 ? <EmptyState className="py-6">—</EmptyState> : <ul className="flex flex-col gap-2">{shownOrders.map(orderCard)}</ul>}
        </div>
      );
    const list = byStage(s);
    const step = STAGE_STEP[s];
    return (
      <div key={s} className="flex min-w-0 flex-col gap-2">
        <p className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground xl:flex">
          {stageLabel(td, s)} <span className="font-normal">({list.length})</span>
        </p>
        {list.length === 0 ? (
          <EmptyState className="py-6">—</EmptyState>
        ) : grouped ? (
          // Todos los proyectos: dentro de la columna, un grupo por proyecto (el que tiene algo atrasado, arriba).
          projectsOf(list.map((i) => ({ projectId: i.projectId, projectName: i.projectName, stageSince: i.stageSince, late: isLate(i) }))).map((p) => {
            const group = list.filter((i) => i.projectId === p.id);
            return (
              <div key={p.id} className="flex flex-col gap-1.5">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <ListGroupHeader title={p.name} count={p.count} />
                  </div>
                  {step && group.length > 1 && (
                    <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => setGroupFor({ ids: group.map((i) => i.id), title: p.name })}>
                      {td(`step_${step}`)}…
                    </Button>
                  )}
                </div>
                <ul className="flex flex-col gap-2">{group.map(card)}</ul>
              </div>
            );
          })
        ) : (
          <>
            {step && list.length > 1 && (
              <Button size="sm" variant="outline" className="h-7 self-end px-2 text-xs" onClick={() => setGroupFor({ ids: list.map((i) => i.id), title: list[0].projectName })}>
                {td(`step_${step}`)}…
              </Button>
            )}
            <ul className="flex flex-col gap-2">{list.map(card)}</ul>
          </>
        )}
      </div>
    );
  };

  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={td("title")} subtitle={td("subtitle")} />
      {hasMine && (
        <SegmentedFilter
          value={scope}
          onChange={(v) => {
            setScope(v);
            saveScope(v);
          }}
          options={[
            { value: "mine" as const, label: td("scope_mine"), icon: UserCheck },
            { value: "all" as const, label: td("scope_all"), icon: ICON.all },
          ]}
        />
      )}
      {shown.length === 0 && shownOrders.length === 0 ? (
        <EmptyState size="page" icon={Palette}>
          {scope === "mine" ? td("board_empty_mine") : td("board_empty")}
        </EmptyState>
      ) : (
        <>
          {projects.length > 1 && (
            <SubTabs
              value={current}
              onChange={setProject}
              tabs={[
                { value: ALL, label: td("all_projects_tab"), badge: <Count n={cards.length} /> },
                ...projects.map((p) => ({
                  value: p.id,
                  label: <span className={p.late ? "text-destructive" : undefined}>{p.name}</span>,
                  badge: <Count n={p.count} />,
                })),
              ]}
            />
          )}
          <div className="flex flex-col gap-3 xl:hidden">
            <SegmentedFilter
              fill
              value={column}
              onChange={setColumn}
              options={COLUMNS.map((c) =>
                c === "orders"
                  ? { value: c, label: `${to("column")} (${count(c)})`, icon: Factory }
                  : { value: c, label: `${stageLabel(td, c)} (${count(c)})`, icon: STATUS[`item_${c}`].icon, iconClass: TONE_TEXT[STATUS[`item_${c}`].tone] },
              )}
            />
            {col(column)}
          </div>
          <div className="hidden gap-4 xl:grid xl:grid-cols-5">{COLUMNS.map(col)}</div>
        </>
      )}
      <StageGroupDialog items={groupFor ? allItems.filter((i) => groupFor.ids.includes(i.id) && i.stage === allItems.find((x) => x.id === groupFor.ids[0])?.stage) : null} title={groupFor?.title ?? ""} onClose={() => setGroupFor(null)} />
      <ItemDialog item={open} siblings={open ? allItems.filter((i) => i.projectId === open.projectId) : []} designers={open?.designers ?? []} projectHref={open ? projectPath(open.projectId, "diseno") : undefined} projectName={open?.projectName} onClose={() => setOpenId(null)} />
    </div>
  );
}
