"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { HandHelping, MapPin, Plus, TriangleAlert, Undo2 } from "lucide-react";

import type { IncomingItem, StoredItem, StoredPerson, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ListToolbar } from "@/components/shared/search-input";
import { PAGE_CLASS } from "@/components/shared/page-header";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatCents } from "@/lib/planilla/payroll-period";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import { EmptyBox, ItemThumb, PageHeader, SearchBox, qtyWithUnit, useTa } from "../shared";
import { StoredDialog } from "./stored-dialog";
import { DeliverDialog } from "./deliver-dialog";
import { undoStoredDeliveryAction } from "./actions";

type Project = { id: string; name: string; active: boolean };
type View = "en_almacen" | "por_llegar" | "entregado";

/**
 * Almacén → Guardado por proyecto: lo que está guardado para cada proyecto (con dónde está), lo especial que se
 * pidió y todavía no llega, y lo ya entregado. Agrupado por proyecto. Registran y entregan Almacén, Diseño y Proyectos.
 */
export function StoredView({
  items,
  incoming,
  people,
  projects,
  suppliers,
  canCosts,
  initialProjectId,
}: {
  items: StoredItem[];
  incoming: IncomingItem[];
  people: StoredPerson[];
  projects: Project[];
  suppliers: Supplier[];
  canCosts: boolean;
  initialProjectId: string | null;
}) {
  const { ta, lang } = useTa();
  const [view, setView] = React.useState<View>("en_almacen");
  const [query, setQuery] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>(initialProjectId ?? "all");
  const [editing, setEditing] = React.useState<StoredItem | "new" | null>(null);
  const [delivering, setDelivering] = React.useState<StoredItem | null>(null);

  const inProject = (projectId: string) => projectFilter === "all" || projectId === projectFilter;
  const q = normalizeSearchText(query);
  const stored = items.filter((i) => inProject(i.projectId) && (!q || matchesSearch(`${i.description} ${i.projectName} ${i.location ?? ""} ${i.projectItemName ?? ""}`, q)));
  const coming = incoming.filter((i) => inProject(i.projectId) && (!q || matchesSearch(`${i.description} ${i.projectName}`, q)));
  const count = (v: View) => (v === "por_llegar" ? coming.length : stored.filter((i) => i.status === v).length);

  // Proyectos con algo (para el filtro), más el que viene en el enlace.
  const projectsWithStuff = React.useMemo(() => {
    const ids = new Set([...items.map((i) => i.projectId), ...incoming.map((i) => i.projectId)]);
    if (initialProjectId) ids.add(initialProjectId);
    return projects.filter((p) => ids.has(p.id));
  }, [items, incoming, projects, initialProjectId]);

  function groupBy<T extends { projectId: string; projectName?: string }>(rows: T[]): [string, string, T[]][] {
    const map = new Map<string, T[]>();
    for (const r of rows) map.set(r.projectId, [...(map.get(r.projectId) ?? []), r]);
    const name = (id: string) => projects.find((p) => p.id === id)?.name ?? rows.find((r) => r.projectId === id)?.projectName ?? "";
    return [...map.entries()].map(([id, rs]) => [id, name(id), rs] as [string, string, T[]]).sort((a, b) => a[1].localeCompare(b[1], "es"));
  }

  async function undo(item: StoredItem) {
    const res = await undoStoredDeliveryAction(item.id);
    if (!res.ok) toast.error(res.error);
  }

  const shown = stored.filter((i) => i.status === view);

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={ta("st_title")}
        subtitle={ta("st_subtitle")}
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" />
            {ta("st_register")}
          </Button>
        }
      />

      <ListToolbar>
        <SearchBox value={query} onChange={setQuery} placeholder={ta("st_search_ph")} />
        {projectsWithStuff.length > 1 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-auto min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ta("st_all_projects")}</SelectItem>
              {projectsWithStuff.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <SegmentedFilter
          value={view}
          onChange={setView}
          options={(["en_almacen", "por_llegar", "entregado"] as const).map((v) => {
            const st = STATUS[`stored_${v}`];
            return { value: v, label: `${ta(`st_f_${v}`)} (${count(v)})`, icon: st.icon, iconClass: TONE_TEXT[st.tone] };
          })}
        />
      </ListToolbar>

      {items.length === 0 && incoming.length === 0 ? (
        <EmptyBox>{ta("st_empty")}</EmptyBox>
      ) : view === "por_llegar" ? (
        coming.length === 0 ? (
          <EmptyBox>{ta("st_empty_filter")}</EmptyBox>
        ) : (
          <div className="flex flex-col gap-5">
            {groupBy(coming).map(([id, name, rows]) => (
              <section key={id} className="flex flex-col gap-2">
                <ListGroupHeader title={name} count={rows.length} icon={ICON.project} />
                <ul className="flex flex-col gap-2">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          {r.description} <span className="text-muted-foreground">· {qtyWithUnit(r.qty, r.unit, lang)}</span>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[r.requestedBy && `${ta("st_requested_by")}: ${r.requestedBy}`, formatDateCompact(lang, r.createdAt.slice(0, 10))].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <StatusBadge status={`purchase_${r.status}`}>{ta(`st_${r.status}`)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : shown.length === 0 ? (
        <EmptyBox>{ta("st_empty_filter")}</EmptyBox>
      ) : (
        <div className="flex flex-col gap-5">
          {groupBy(shown).map(([id, name, rows]) => (
            <section key={id} className="flex flex-col gap-2">
              <ListGroupHeader title={name} count={rows.length} icon={ICON.project} />
              <ul className="flex flex-col gap-2">
                {rows.map((r) => (
                  <li key={r.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setEditing(r)}
                      onKeyDown={(e) => e.key === "Enter" && setEditing(r)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left hover:border-ring"
                    >
                      <ItemThumb path={r.photoPath} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-foreground">{r.description}</span>
                          <span className="text-sm text-muted-foreground">· {qtyWithUnit(r.qty, r.unit, lang)}</span>
                          {r.origin === "cliente" ? (
                            <StatusBadge status="stored_cliente">{ta("st_badge_cliente")}</StatusBadge>
                          ) : (
                            <StatusBadge status="stored_ebony">{ta("st_badge_ebony")}</StatusBadge>
                          )}
                        </span>
                        {r.projectItemName && <span className="block truncate text-xs text-muted-foreground">{r.projectItemName}</span>}
                        {r.status === "entregado" ? (
                          <span className="block text-xs text-muted-foreground">
                            {ta("st_delivered_to")} {r.deliveredToName} · {r.deliveredOn ? formatDateCompact(lang, r.deliveredOn) : ""}
                          </span>
                        ) : r.location ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{r.location}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-[var(--status-warn)]">
                            <TriangleAlert className="size-3 shrink-0" />
                            {ta("st_no_location")}
                          </span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {[
                            formatDateCompact(lang, r.receivedOn),
                            r.receivedByName && `${ta("st_received_by")}: ${r.receivedByName}`,
                            r.supplierName,
                            r.totalCents != null ? formatCents(r.totalCents) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {r.status === "en_almacen" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDelivering(r);
                          }}
                        >
                          <HandHelping className="size-3.5" />
                          <span className="hidden sm:inline">{ta("st_deliver")}</span>
                        </Button>
                      ) : (
                        <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                          <ConfirmButton icon={Undo2} iconOnly label={ta("st_undo_delivery")} confirmLabel={ta("st_undo_confirm")} onConfirm={() => void undo(r)} />
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <StoredDialog
        item={editing}
        defaultProjectId={projectFilter !== "all" ? projectFilter : null}
        projects={projects}
        suppliers={suppliers}
        canCosts={canCosts}
        onClose={() => setEditing(null)}
        onDeliver={(it) => {
          setEditing(null);
          setDelivering(it);
        }}
      />
      <DeliverDialog item={delivering} people={people} onClose={() => setDelivering(null)} />
    </div>
  );
}
