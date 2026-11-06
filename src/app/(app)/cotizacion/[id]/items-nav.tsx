"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronRight, Copy, GripVertical, List, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput } from "@/components/shared/search-input";
import { RowMenu } from "@/components/shared/row-menu";
import { formatMoney, sectionTotals } from "@/lib/cotizador/pricing";
import { locationGroups } from "@/lib/cotizador/items";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { QuoteSection } from "@/types/cotizador";

type Tk = keyof typeof strings.cotizador;

export interface ItemsNavProps {
  sections: QuoteSection[];
  currentId: string | null;
  onSelect: (id: string) => void;
  locked: boolean;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onShift: (id: string, delta: -1 | 1) => void;
  /** Soltar `id` antes de `beforeId` (null = al final del grupo `groupKey`). */
  onMove: (id: string, beforeId: string | null) => void;
}

const qtyLabel = (s: QuoteSection) => (s.qty > 1 ? `× ${s.qty.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : null);

/**
 * La lista de ítems, agrupada por ubicación, con el subtotal de cada una.
 * Buscar, plegar ubicaciones, arrastrar para reordenar (en computadora; al
 * soltar en otra ubicación toma esa ubicación) y, en el "⋯" de cada ítem,
 * duplicar, subir, bajar y eliminar.
 */
export function ItemsPanel({ sections, currentId, onSelect, locked, onAdd, onDuplicate, onRemove, onShift, onMove, draggable = true }: ItemsNavProps & { draggable?: boolean }) {
  const { lang } = useLang();
  const tt = (k: Tk) => t(lang, strings.cotizador[k]);
  const [search, setSearch] = React.useState("");
  const [closed, setClosed] = React.useState<Set<string>>(new Set());
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  const q = normalizeSearchText(search);
  const groups = locationGroups(sections)
    .map((g) => ({ ...g, shown: q ? g.sections.filter((s) => [s.name, s.location, s.kind].some((v) => matchesSearch(v, q))) : g.sections }))
    .filter((g) => g.shown.length > 0);
  const canDrag = draggable && !locked && !q;

  const drop = (beforeId: string | null) => {
    if (dragId && dragId !== beforeId) onMove(dragId, beforeId);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {sections.length > 6 && <SearchInput value={search} onChange={setSearch} placeholder={tt("items_search")} />}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
        {groups.map((g) => {
          const isClosed = closed.has(g.key) && !q;
          return (
            <section key={g.key} className="flex flex-col">
              <button
                type="button"
                onClick={() =>
                  setClosed((c) => {
                    const next = new Set(c);
                    if (next.has(g.key)) next.delete(g.key);
                    else next.add(g.key);
                    return next;
                  })
                }
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase hover:bg-muted/50"
              >
                <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", !isClosed && "rotate-90")} />
                <span className="min-w-0 flex-1 truncate">{g.label || tt("sec_no_location")}</span>
                <span className="font-normal tabular-nums normal-case">{formatMoney(g.total)}</span>
              </button>
              {!isClosed && (
                <ul className="flex flex-col gap-0.5 pl-1.5">
                  {g.shown.map((s) => {
                    const active = s.id === currentId;
                    return (
                      <li
                        key={s.id}
                        draggable={canDrag}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(s.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverId(null);
                        }}
                        onDragOver={(e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          setOverId(s.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          drop(s.id);
                        }}
                        className={cn(
                          "group relative flex items-center gap-1 rounded-md border pr-0.5",
                          active ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/50",
                          dragId === s.id && "opacity-40",
                          overId === s.id && dragId !== s.id && "before:absolute before:inset-x-1 before:-top-[3px] before:h-0.5 before:rounded-full before:bg-primary",
                        )}
                      >
                        {canDrag && <GripVertical className="ml-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />}
                        <button type="button" onClick={() => onSelect(s.id)} aria-current={active || undefined} className={cn("flex min-w-0 flex-1 items-baseline gap-2 py-1.5 text-left text-sm", !canDrag && "pl-2")}>
                          <span className={cn("min-w-0 flex-1 truncate", active ? "font-semibold text-foreground" : "text-foreground/90")}>{s.name || tt("sec_unnamed")}</span>
                          {qtyLabel(s) && <span className="shrink-0 text-xs font-semibold text-primary tabular-nums">{qtyLabel(s)}</span>}
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatMoney(sectionTotals(s).total)}</span>
                        </button>
                        {!locked && (
                          <RowMenu
                            label={tt("more_actions")}
                            items={[
                              { label: tt("item_duplicate"), icon: Copy, onSelect: () => onDuplicate(s.id) },
                              { label: tt("item_up"), icon: ArrowUp, onSelect: () => onShift(s.id, -1) },
                              { label: tt("item_down"), icon: ArrowDown, onSelect: () => onShift(s.id, 1) },
                              { label: tt("delete"), icon: Trash2, confirmLabel: tt("item_delete_confirm"), onSelect: () => onRemove(s.id) },
                            ]}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {groups.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">{tt("no_results")}</p>}
        {/* Soltar al final. */}
        {canDrag && dragId && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOverId("__end");
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(null);
            }}
            className={cn("h-8 rounded-md border border-dashed", overId === "__end" ? "border-primary" : "border-border")}
          />
        )}
      </div>
      {!locked && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd} className="shrink-0 self-start">
          <Plus className="size-3.5" />
          {tt("sec_add")}
        </Button>
      )}
    </div>
  );
}

/**
 * En celular: los ítems como pestañas que se deslizan de lado (se ve cuál
 * sigue), la activa siempre a la vista, y "Ver todos" abre la lista agrupada.
 */
export function ItemTabs(props: ItemsNavProps) {
  const { sections, currentId, onSelect, locked, onAdd } = props;
  const { lang } = useLang();
  const tt = (k: Tk) => t(lang, strings.cotizador[k]);
  const [all, setAll] = React.useState(false);
  const activeRef = React.useRef<HTMLButtonElement>(null);
  const ordered = locationGroups(sections).flatMap((g) => g.sections);

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentId]);

  return (
    <div className="flex items-stretch gap-1.5">
      <div className="-mx-1 flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ordered.map((s) => {
          const active = s.id === currentId;
          return (
            <button
              key={s.id}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "grid max-w-[180px] shrink-0 snap-start rounded-lg border px-3 py-1.5 text-left",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
              )}
            >
              <span className={cn("truncate text-[10px] tracking-[0.08em] uppercase", active ? "text-primary-foreground/70" : "text-muted-foreground")}>{s.location || tt("sec_no_location")}</span>
              <span className="truncate text-sm leading-tight font-semibold">
                {s.name || tt("sec_unnamed")}
                {qtyLabel(s) && <span className="ml-1 font-normal">{qtyLabel(s)}</span>}
              </span>
              <span className={cn("text-[11px] tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{formatMoney(sectionTotals(s).total)}</span>
            </button>
          );
        })}
        {!locked && (
          <button type="button" onClick={onAdd} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-input px-3 text-xs font-medium text-foreground/80">
            <Plus className="size-3.5" />
            {tt("sec_add")}
          </button>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-auto shrink-0 flex-col gap-0.5 px-2.5 text-[11px]" onClick={() => setAll(true)}>
        <List className="size-4" />
        {tt("items_all")}
      </Button>
      <Sheet open={all} onOpenChange={setAll}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>
              {tt("items_title")} ({sections.length})
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <ItemsPanel
              {...props}
              draggable={false}
              onSelect={(id) => {
                onSelect(id);
                setAll(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
