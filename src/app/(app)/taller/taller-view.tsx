"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Cpu, Factory, Inbox, Palette, Plus, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PAGE_CLASS, PageHeader, ShowToggle, SubTabs } from "@/components/shared/page-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { STATUS, TONE_TEXT } from "@/lib/ui/status";
import { ICON } from "@/lib/ui/concepts";
import type { TallerData, WorkOrder, WorkOrderKind, WorkOrderStatus } from "@/types/taller";
import { WorkOrderCard, statusLabel, useTt } from "./shared";
import { WorkOrderDialog } from "./work-order-dialog";
import { WorkOrderDetail } from "./work-order-detail";
import { SampleRequestDialog } from "./sample-request-dialog";
import { ColorsList } from "./colors-view";
import { PaintersView } from "./painters-view";

type View = "trabajos" | "colores" | "pintores";
const VIEWS: readonly View[] = ["trabajos", "colores", "pintores"];

type Scope = "all" | "mine" | "requested";
const SCOPE_KEY = "taller.scope";
const COLUMNS: WorkOrderStatus[] = ["por_hacer", "en_proceso", "listo"];
/** Cada cuánto se refresca sola mientras la pantalla está a la vista (el operario la deja abierta junto a la máquina). */
const REFRESH_MS = 3 * 60 * 1000;

function readScope(): Scope | null {
  try {
    const v = window.localStorage.getItem(SCOPE_KEY);
    return v === "all" || v === "mine" || v === "requested" ? v : null;
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
 * Taller → Trabajos: la cola de trabajos de todas las áreas (por ahora CNC). Lo de cada uno es un filtro (Todos /
 * Asignados a mí / Pedidos por mí); la app recuerda el último. Tablero por estado; en el teléfono, una columna a la vez.
 */
export function TallerView({ data, initialOpenId, initialView }: { data: TallerData; initialOpenId?: string | null; initialView?: string }) {
  const { tt } = useTt();
  const router = useRouter();
  const [view, setView] = React.useState<View>(VIEWS.includes(initialView as View) ? (initialView as View) : "trabajos");
  const [typeFilter, setTypeFilter] = React.useState<"all" | WorkOrderKind>("all");
  const [scope, setScope] = React.useState<Scope>("all");
  const [personFilter, setPersonFilter] = React.useState("all");
  const [projectFilter, setProjectFilter] = React.useState("all");
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [mobileColumn, setMobileColumn] = React.useState<WorkOrderStatus>("por_hacer");
  const [openId, setOpenId] = React.useState<string | null>(initialOpenId ?? null);
  const [editing, setEditing] = React.useState<WorkOrder | null>(null);
  const [adding, setAdding] = React.useState<WorkOrderKind | null>(null);

  // El filtro de la última vez; si es la primera vez y tiene trabajos asignados, abre en «Asignados a mí».
  /* eslint-disable react-hooks/set-state-in-effect -- se lee el navegador una vez al abrir. */
  React.useEffect(() => {
    const saved = readScope();
    if (saved) setScope(saved);
    else if (data.meEmployeeId && data.orders.some((o) => o.assigneeId === data.meEmployeeId)) setScope("mine");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Se refresca sola mientras está a la vista, y al volver a la pestaña.
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  const peopleById = React.useMemo(() => new Map(data.people.map((p) => [p.employeeId, p])), [data.people]);
  const paintersById = React.useMemo(() => new Map(data.painters.map((p) => [p.contractorId, p])), [data.painters]);

  const changeView = (v: View) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === "trabajos") url.searchParams.delete("vista");
    else url.searchParams.set("vista", v);
    window.history.replaceState(null, "", url);
  };

  const filtered = data.orders.filter((o) => {
    if (scope === "mine" && (!data.meEmployeeId || o.assigneeId !== data.meEmployeeId)) return false;
    if (scope === "requested" && o.requestedBy !== data.meUserId) return false;
    if (typeFilter !== "all" && o.kind !== typeFilter) return false;
    if (personFilter !== "all" && `e:${o.assigneeId}` !== personFilter && `c:${o.assigneeContractorId}` !== personFilter) return false;
    if (projectFilter === "internal" ? o.projectId !== null : projectFilter !== "all" && o.projectId !== projectFilter) return false;
    return true;
  });
  const byStatus = (s: WorkOrderStatus) => filtered.filter((o) => o.status === s);
  const cancelled = byStatus("cancelado");

  const assigneeOptions = [
    ...data.people.filter((p) => data.orders.some((o) => o.assigneeId === p.employeeId)).map((p) => ({ value: `e:${p.employeeId}`, label: p.name })),
    ...data.painters.filter((p) => data.orders.some((o) => o.assigneeContractorId === p.contractorId)).map((p) => ({ value: `c:${p.contractorId}`, label: p.name })),
  ];
  const hasSamples = data.orders.some((o) => o.kind === "muestra");
  const projectOptions = data.projects.filter((p) => data.orders.some((o) => o.projectId === p.id));
  const openOrder = data.orders.find((o) => o.id === openId) ?? data.colorOrders.find((o) => o.id === openId) ?? null;

  const column = (s: WorkOrderStatus) => {
    const list = s === "listo" && showCancelled ? [...byStatus("listo"), ...cancelled] : byStatus(s);
    return (
      <div key={s} className="flex min-w-0 flex-col gap-2">
        <p className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground md:flex">
          {statusLabel(tt, s)} <span className="font-normal">({byStatus(s).length})</span>
        </p>
        {list.length === 0 ? (
          <EmptyState className="py-6">{tt("empty_column")}</EmptyState>
        ) : (
          list.map((o) => (
            <WorkOrderCard
              key={o.id}
              order={o}
              person={o.assigneeId ? peopleById.get(o.assigneeId) : undefined}
              painter={o.assigneeContractorId ? paintersById.get(o.assigneeContractorId) : undefined}
              tt={tt}
              onOpen={() => setOpenId(o.id)}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={tt("title")}
        subtitle={tt("subtitle")}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="size-4" />
                {tt("new")}
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAdding("cnc")}>
                <Cpu className="size-4" />
                {tt("new_cnc")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAdding("muestra")}>
                <Palette className="size-4" />
                {tt("new_muestra")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <SubTabs
        value={view}
        onChange={changeView}
        tabs={[
          { value: "trabajos" as const, label: tt("tab_trabajos") },
          { value: "colores" as const, label: tt("tab_colores") },
          { value: "pintores" as const, label: tt("tab_pintores") },
        ]}
      />

      {view === "colores" && <ColorsList orders={data.colorOrders} painters={data.painters} veneers={data.veneers} onOpen={setOpenId} />}
      {view === "pintores" && <PaintersView painters={data.painters} veneers={data.veneers} />}

      {view === "trabajos" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedFilter
              fill
              value={scope}
              onChange={(v) => {
                setScope(v);
                saveScope(v);
              }}
              options={[
                { value: "all" as const, label: tt("scope_all"), icon: Factory },
                { value: "mine" as const, label: tt("scope_mine"), icon: UserCheck },
                { value: "requested" as const, label: tt("scope_requested"), icon: Inbox },
              ]}
            />
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="h-9 w-full min-w-44 sm:w-auto">
                <ICON.owner className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tt("all_people")}</SelectItem>
                {assigneeOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasSamples && (
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | WorkOrderKind)}>
                <SelectTrigger className="h-9 w-full min-w-36 sm:w-auto">
                  <Factory className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tt("type_all")}</SelectItem>
                  <SelectItem value="cnc">{tt("kind_cnc")}</SelectItem>
                  <SelectItem value="muestra">{tt("kind_muestra")}</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-full min-w-44 sm:w-auto">
                <ICON.project className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tt("all_projects")}</SelectItem>
                <SelectItem value="internal">{tt("internal")}</SelectItem>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cancelled.length > 0 && (
              <ShowToggle checked={showCancelled} onChange={setShowCancelled} label={`${tt("show_cancelled")} (${cancelled.length})`} />
            )}
          </div>

          {data.orders.length === 0 ? (
            <EmptyState size="page">
              <Factory className="size-6" />
              <p>{tt("empty")}</p>
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState size="page">{tt("no_results")}</EmptyState>
          ) : (
            <>
              {/* Teléfono: una columna a la vez. */}
              <div className="flex flex-col gap-3 md:hidden">
                <SegmentedFilter
                  fill
                  value={mobileColumn}
                  onChange={setMobileColumn}
                  options={COLUMNS.map((s) => ({
                    value: s,
                    label: `${statusLabel(tt, s)} (${byStatus(s).length})`,
                    icon: STATUS[`work_${s}`].icon,
                    iconClass: TONE_TEXT[STATUS[`work_${s}`].tone],
                  }))}
                />
                {column(mobileColumn)}
              </div>
              {/* Computadora: el tablero completo. */}
              <div className="hidden gap-4 md:grid md:grid-cols-3">{COLUMNS.map(column)}</div>
            </>
          )}
        </>
      )}

      <WorkOrderDetail
        order={openOrder}
        people={data.people}
        painters={data.painters}
        veneers={data.veneers}
        onClose={() => setOpenId(null)}
        onEdit={(o) => {
          setOpenId(null);
          setEditing(o);
        }}
      />
      <WorkOrderDialog
        open={adding === "cnc" || (editing !== null && editing.kind === "cnc")}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(null);
            setEditing(null);
          }
        }}
        order={editing?.kind === "cnc" ? editing : null}
        people={data.people}
        projects={data.projects}
        onSaved={(id) => setOpenId(id)}
      />
      <SampleRequestDialog
        open={adding === "muestra" || (editing !== null && editing.kind === "muestra")}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(null);
            setEditing(null);
          }
        }}
        order={editing?.kind === "muestra" ? editing : null}
        painters={data.painters}
        veneers={data.veneers}
        projects={data.projects}
        onSaved={(id) => setOpenId(id)}
      />
    </div>
  );
}
