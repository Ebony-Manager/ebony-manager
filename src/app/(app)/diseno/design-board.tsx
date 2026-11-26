"use client";

import * as React from "react";
import { Palette, UserCheck } from "lucide-react";

import { EmptyState, PAGE_CLASS, PageHeader, SubTabs } from "@/components/shared/page-header";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import { projectPath } from "@/app/(app)/proyectos/paths";
import { Factory } from "lucide-react";
import { DESIGN_STAGES, STAGE_LATE_DAYS, type BoardItem, type ItemStage } from "@/types/diseno";
import { DESIGN_ORDER_STATUSES, type OrderSummary } from "@/types/produccion";
import { orderMissing } from "@/lib/produccion/missing";
import { OrderStatusBadge, itemsLabel, missingText, useTo } from "./orden/shared";
import { OrderDialog } from "./orden/order-dialog";
import { BlockDialog } from "./stage-panel";
import { toBlocks, type Block } from "@/lib/diseno/blocks";
import { hasStepFile } from "@/lib/diseno/steps";
import { CircleCheck } from "lucide-react";
import { STAGE_STEP } from "@/lib/diseno/steps";
import { ItemCardNotes, daysInStage, daysLabel, designerName, isLate, stageLabel, useTd } from "./shared";
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
  // La orden de producción abierta en su ventana flotante.
  const [orderId, setOrderId] = React.useState<string | null>(null);
  // El bloque abierto (su panel: documentos, ítems y el paso).
  const [blockFor, setBlockFor] = React.useState<string | null>(null);

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
    ...toBlocks(inScope).map((b) => ({ projectId: b.projectId, projectName: b.items[0].projectName, stageSince: b.since, late: b.items.some((i) => isLate(i)) })),
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
  const grouped = current === ALL && projects.length > 1;
  // Los ítems de cada columna juntos en bloques (lo que se trabaja y avanza junto): lo atrasado arriba.
  const blockLate = (b: Block<BoardItem>) => b.items.some((i) => isLate(i));
  const byStage = (s: ItemStage) =>
    toBlocks(shown.filter((i) => i.stage === s)).sort((a, b) => Number(blockLate(b)) - Number(blockLate(a)) || a.since.localeCompare(b.since));
  const count = (c: Column) => (c === "orders" ? `${shownOrders.length}` : `${byStage(c).length}`);
  const itemsIn = (c: ItemStage) => shown.filter((i) => i.stage === c).length;
  const blockTitle = (b: Block<BoardItem>) => (b.items.length === 1 ? b.items[0].name : b.areas.join(" · ") || td("no_area"));

  const blockCard = (b: Block<BoardItem>) => {
    const late = blockLate(b);
    const first = b.items[0];
    const step = STAGE_STEP[b.stage];
    const ready = step ? b.items.filter((i) => hasStepFile(i, step)).length : 0;
    const names = [...new Set(b.items.map((i) => designerName(td, i.designerId, i.designers)))];
    const single = b.items.length === 1;
    const where = single ? first.area : "";
    return (
      <li key={b.key} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40">
        <button type="button" onClick={() => setBlockFor(b.key)} className="flex flex-col gap-0.5 text-left">
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{blockTitle(b)}</span>
            {!single && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{td("items_n", { n: b.items.length })}</span>}
          </span>
          {(where || !grouped) && (
            <span className="truncate text-xs text-muted-foreground">{[grouped || current !== ALL ? "" : first.projectName, where].filter(Boolean).join(" · ")}</span>
          )}
        </button>
        {!single && (
          // Los ítems del bloque: tocar uno abre su ficha.
          <span className="flex flex-wrap gap-1">
            {b.items.map((i) => (
              <button key={i.id} type="button" onClick={() => setOpenId(i.id)} className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground hover:bg-muted">
                {i.name}
              </button>
            ))}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className={late ? "font-medium text-destructive" : ""}>
            {late ? `${td("late")} · ` : ""}
            {daysLabel(td, daysInStage({ stageSince: b.since }))}
          </span>
          {single ? (
            <ItemCardNotes item={first} />
          ) : (
            <>
              {step && ready > 0 && (
                <span className={`inline-flex items-center gap-1 font-medium ${ready === b.items.length ? "text-primary" : "text-foreground"}`}>
                  · {ready === b.items.length && <CircleCheck className="size-3" />}
                  {td("docs_count", { doc: td(`doc_short_${step}`), n: ready, total: b.items.length })}
                </span>
              )}
              {b.items.every((i) => i.waitingClient) && <span>· {td("waiting_client")}</span>}
              {b.items.some((i) => i.areaNotReady) && <span>· {td("area_not_ready")}</span>}
            </>
          )}
          {(scope === "all" || b.items.some((i) => !i.designerId)) && first.designers.length > 0 && (
            <span className="flex items-center gap-1">
              · <ICON.designer className="size-3" />
              {names.join(", ")}
            </span>
          )}
        </span>
      </li>
    );
  };

  const orderCard = (o: OrderSummary) => {
    const late = orderLate(o);
    const missing = orderMissing({ itemCount: o.itemIds.length, fileKinds: o.fileKinds, laborCount: o.laborCount });
    const editing = o.status !== "en_revision";
    return (
      <li key={o.id}>
        <button type="button" onClick={() => setOrderId(o.id)} className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40">
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
        </button>
      </li>
    );
  };

  const col = (s: Column) => {
    if (s === "orders")
      return (
        <div key={s} className="flex min-w-0 flex-col gap-2">
          <p className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground lg:flex">
            {to("column")} <span className="font-normal">({shownOrders.length})</span>
          </p>
          {shownOrders.length === 0 ? <EmptyState className="py-6">—</EmptyState> : <ul className="flex flex-col gap-2">{shownOrders.map(orderCard)}</ul>}
        </div>
      );
    const list = byStage(s);
    return (
      <div key={s} className="flex min-w-0 flex-col gap-2">
        <p className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground lg:flex">
          {stageLabel(td, s)} <span className="font-normal">({td("blocks_count", { n: list.length, items: itemsIn(s) })})</span>
        </p>
        {list.length === 0 ? (
          <EmptyState className="py-6">—</EmptyState>
        ) : grouped ? (
          // Todos los proyectos: dentro de la columna, un grupo por proyecto (el que tiene algo atrasado, arriba).
          projectsOf(list.map((b) => ({ projectId: b.projectId, projectName: b.items[0].projectName, stageSince: b.since, late: blockLate(b) }))).map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <ListGroupHeader title={p.name} count={p.count} />
              <ul className="flex flex-col gap-2">{list.filter((b) => b.projectId === p.id).map(blockCard)}</ul>
            </div>
          ))
        ) : (
          <ul className="flex flex-col gap-2">{list.map(blockCard)}</ul>
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
          <div className="flex flex-col gap-3 lg:hidden">
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
          <div className="hidden gap-4 lg:grid lg:grid-cols-4">{COLUMNS.map(col)}</div>
        </>
      )}
      {(() => {
        const b = blockFor ? toBlocks(items).find((x) => x.key === blockFor) : undefined;
        return (
          <BlockDialog
            items={b?.items ?? null}
            title={b ? blockTitle(b) : ""}
            projectName={b?.items[0].projectName ?? ""}
            onOpenItem={(id) => {
              setBlockFor(null);
              setOpenId(id);
            }}
            onOpenOrder={(id) => {
              setBlockFor(null);
              setOrderId(id);
            }}
            onClose={() => setBlockFor(null)}
          />
        );
      })()}
      <OrderDialog orderId={orderId} onClose={() => setOrderId(null)} />
      <ItemDialog
        onOpenOrder={(id) => {
          setOpenId(null);
          setOrderId(id);
        }}
        item={open}
        orders={allOrders} siblings={open ? allItems.filter((i) => i.projectId === open.projectId) : []} designers={open?.designers ?? []} projectHref={open ? projectPath(open.projectId, "diseno") : undefined} projectName={open?.projectName} onClose={() => setOpenId(null)} />
    </div>
  );
}
