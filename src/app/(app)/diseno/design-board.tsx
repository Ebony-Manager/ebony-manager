"use client";

import * as React from "react";
import { Palette, UserCheck } from "lucide-react";

import { EmptyState, PAGE_CLASS, PageHeader, SubTabs } from "@/components/shared/page-header";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import { projectPath } from "@/app/(app)/proyectos/paths";
import { DESIGN_STAGES, type BoardItem, type ItemStage } from "@/types/diseno";
import { daysInStage, daysLabel, isLate, stageLabel, useTd } from "./shared";
import { ItemDialog } from "./item-dialog";

type Scope = "mine" | "all";
const ALL = "__all__";

type ProjectTab = { id: string; name: string; count: number; late: boolean; oldest: string };

/** Los proyectos de una lista de ítems: los que tienen algo atrasado primero; después, el que espera hace más tiempo. */
function projectsOf(items: BoardItem[]): ProjectTab[] {
  const map = new Map<string, ProjectTab>();
  for (const i of items) {
    const p = map.get(i.projectId) ?? { id: i.projectId, name: i.projectName, count: 0, late: false, oldest: i.stageSince };
    p.count += 1;
    p.late ||= isLate(i);
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
export function DesignBoard({ items, myProjectIds }: { items: BoardItem[]; myProjectIds: string[] }) {
  const { td } = useTd();
  const hasMine = myProjectIds.length > 0;
  const [scope, setScope] = React.useState<Scope>(hasMine ? "mine" : "all");
  const [column, setColumn] = React.useState<ItemStage>("por_medir");
  const [openId, setOpenId] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- se lee el navegador una vez al abrir. */
  React.useEffect(() => {
    const saved = readScope();
    if (saved && (saved === "all" || hasMine)) setScope(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mine = React.useMemo(() => new Set(myProjectIds), [myProjectIds]);
  const inScope = scope === "mine" ? items.filter((i) => mine.has(i.projectId)) : items;
  // Una pestaña por proyecto (los que tienen algo atrasado primero) para ver uno solo.
  const projects = React.useMemo(() => projectsOf(inScope), [inScope]);
  const [project, setProject] = React.useState<string>(ALL);
  const current = projects.some((p) => p.id === project) ? project : ALL;
  const shown = current === ALL ? inScope : inScope.filter((i) => i.projectId === current);
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
            {scope === "all" && i.designers.length > 0 && (
              <span className="flex items-center gap-1">
                · <ICON.designer className="size-3" />
                {i.designers.join(", ")}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  const col = (s: ItemStage) => {
    const list = byStage(s);
    return (
      <div key={s} className="flex min-w-0 flex-col gap-2">
        <p className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground md:flex">
          {stageLabel(td, s)} <span className="font-normal">({list.length})</span>
        </p>
        {list.length === 0 ? (
          <EmptyState className="py-6">—</EmptyState>
        ) : grouped ? (
          // Todos los proyectos: dentro de la columna, un grupo por proyecto (el que tiene algo atrasado, arriba).
          projectsOf(list).map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <ListGroupHeader title={p.name} count={p.count} />
              <ul className="flex flex-col gap-2">{list.filter((i) => i.projectId === p.id).map(card)}</ul>
            </div>
          ))
        ) : (
          <ul className="flex flex-col gap-2">{list.map(card)}</ul>
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
      {shown.length === 0 ? (
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
                { value: ALL, label: td("all_projects_tab"), badge: <Count n={inScope.length} /> },
                ...projects.map((p) => ({
                  value: p.id,
                  label: <span className={p.late ? "text-destructive" : undefined}>{p.name}</span>,
                  badge: <Count n={p.count} />,
                })),
              ]}
            />
          )}
          <div className="flex flex-col gap-3 md:hidden">
            <SegmentedFilter
              fill
              value={column}
              onChange={setColumn}
              options={DESIGN_STAGES.map((s) => ({
                value: s,
                label: `${stageLabel(td, s)} (${byStage(s).length})`,
                icon: STATUS[`item_${s}`].icon,
                iconClass: TONE_TEXT[STATUS[`item_${s}`].tone],
              }))}
            />
            {col(column)}
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-4">{DESIGN_STAGES.map(col)}</div>
        </>
      )}
      <ItemDialog item={open} projectHref={open ? projectPath(open.projectId, "diseno") : undefined} projectName={open?.projectName} onClose={() => setOpenId(null)} />
    </div>
  );
}
