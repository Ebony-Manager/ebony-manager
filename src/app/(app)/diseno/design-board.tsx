"use client";

import * as React from "react";
import { Palette, UserCheck } from "lucide-react";

import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import { projectPath } from "@/app/(app)/proyectos/paths";
import { DESIGN_STAGES, type BoardItem, type ItemStage } from "@/types/diseno";
import { daysInStage, daysLabel, isLate, stageLabel, useTd } from "./shared";
import { ItemDialog } from "./item-dialog";

type Scope = "mine" | "all";
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
  const shown = scope === "mine" ? items.filter((i) => mine.has(i.projectId)) : items;
  const byStage = (s: ItemStage) =>
    shown
      .filter((i) => i.stage === s)
      // Lo atrasado arriba; después, lo que lleva más tiempo.
      .sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || a.stageSince.localeCompare(b.stageSince));

  const card = (i: BoardItem) => {
    const late = isLate(i);
    return (
      <li key={i.id}>
        <button
          type="button"
          onClick={() => setOpenId(i.id)}
          className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
        >
          <span className="text-sm font-medium text-foreground">{i.name}</span>
          <span className="truncate text-xs text-muted-foreground">{[i.projectName, i.area].filter(Boolean).join(" · ")}</span>
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
        {list.length === 0 ? <EmptyState className="py-6">—</EmptyState> : <ul className="flex flex-col gap-2">{list.map(card)}</ul>}
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
