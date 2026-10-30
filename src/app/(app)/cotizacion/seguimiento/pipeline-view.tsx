"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { CalendarClock, Columns3, List, CheckCircle2, Inbox, Percent, Plus, Send } from "lucide-react";

import { STAGES, type Client, type LostReason, type Opportunity, type SalesPerson, type Stage } from "@/types/ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/shared/kpi-card";
import { RowMenu } from "@/components/shared/row-menu";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ListToolbar, SearchInput } from "@/components/shared/search-input";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatMoney } from "@/lib/cotizador/pricing";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { daysSince, opportunityAlert, opportunityAmount, opportunityPeople, opportunityTitle, salesStats, sortForBoard, visibleOnBoard } from "@/lib/ventas/opportunities";
import { cn } from "@/lib/utils";
import { setOpportunityStageAction } from "../ventas-actions";
import { CotizacionTabs, STAGE_META, StageBadge, StageIcon, useTv } from "../ventas-common";
import { OpportunityDialog, type SalesProject } from "./opportunity-dialog";
import { ApproveDialog, LostDialog } from "./stage-dialogs";

type View = "board" | "list";

/**
 * Cotización → Seguimiento: lo que entra para cotizar, por etapa (Por
 * cotizar → Cotizando → Enviada → Aprobada / Perdida). Arriba los números
 * del mes; en el tablero, primero lo que pide atención (entrega vencida o
 * enviada sin respuesta). Mover a Perdida pide el motivo; a Aprobada crea
 * (o enlaza) el proyecto.
 */
export function PipelineView({
  opportunities,
  clients,
  people,
  projects,
  openId,
  driveEnabled,
  currentUserId,
}: {
  opportunities: Opportunity[];
  clients: Client[];
  people: SalesPerson[];
  projects: SalesProject[];
  openId: string | null;
  driveEnabled: boolean;
  currentUserId: string;
}) {
  const { tv } = useTv();
  const today = todayInPanama();
  const [query, setQuery] = React.useState("");
  const [owner, setOwner] = React.useState("all");
  const [view, setView] = React.useState<View>("board");
  const [mobileStage, setMobileStage] = React.useState<Stage>("por_cotizar");
  const [editing, setEditing] = React.useState<Opportunity | "new" | null>(() => opportunities.find((o) => o.id === openId) ?? null);
  const [losing, setLosing] = React.useState<Opportunity | null>(null);
  const [approving, setApproving] = React.useState<Opportunity | null>(null);

  const clientById = React.useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  // La ficha abierta se refresca con los datos nuevos del servidor.
  const editingNow = editing && editing !== "new" ? (opportunities.find((o) => o.id === editing.id) ?? editing) : editing;

  const filtered = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return opportunities
      .filter((o) => owner === "all" || o.ownerId === owner)
      .filter((o) => !q || matchesSearch(`${o.title} ${opportunityPeople(o, clientById)} ${o.location ?? ""} ${o.ownerName ?? ""}`, q));
  }, [opportunities, owner, query, clientById]);

  const monthStart = `${today.slice(0, 7)}-01`;
  const stats = React.useMemo(() => salesStats(opportunities, monthStart, today), [opportunities, monthStart, today]);
  const byStage = React.useMemo(() => {
    const map = new Map<Stage, Opportunity[]>(STAGES.map((s) => [s, []]));
    for (const o of filtered) if (visibleOnBoard(o, today)) map.get(o.stage)!.push(o);
    for (const s of STAGES) map.set(s, sortForBoard(map.get(s)!, today));
    return map;
  }, [filtered, today]);

  async function move(o: Opportunity, stage: Stage, lostReason: LostReason | null = null, lostNote: string | null = null) {
    if (stage === "perdida" && !lostReason) return setLosing(o);
    if (stage === "aprobada") return setApproving(o);
    const res = await setOpportunityStageAction(o.id, stage, lostReason, lostNote);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tv("moved", { s: tv(`stage_${stage}`) }));
  }

  const card = (o: Opportunity) => (
    <OppCard key={o.id} o={o} clients={clientById} today={today} onOpen={() => setEditing(o)} onMove={(s) => void move(o, s)} />
  );

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={tv("seg_title")}
        subtitle={tv("seg_subtitle")}
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" />
            <span className="sm:hidden">{tv("new_opportunity")}</span>
            <span className="hidden sm:inline">{tv("new_opportunity_long")}</span>
          </Button>
        }
      />
      <CotizacionTabs value="seguimiento" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard icon={Inbox} label={tv("kpi_received")} value={stats.received} sublabel={tv("kpi_period")} />
        <KpiCard icon={Send} tone="primary" label={tv("kpi_sent")} value={stats.sent} sublabel={tv("kpi_quoted_of", { t: formatMoney(stats.quotedAmount) })} />
        <KpiCard icon={CheckCircle2} tone="positive" label={tv("kpi_approved")} value={stats.approved} sublabel={formatMoney(stats.approvedAmount)} />
        <KpiCard
          icon={Percent}
          tone="warning"
          label={tv("kpi_close_rate")}
          value={stats.closeRate == null ? "—" : `${Math.round(stats.closeRate * 100)}%`}
          sublabel={`${tv("kpi_close_hint")} · ${stats.lost} ${tv("kpi_lost").toLowerCase()}`}
        />
      </div>

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={tv("search_ph")} className="w-full flex-[1_1_220px] sm:max-w-sm" />
        {people.length > 1 && (
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-9 w-auto min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tv("filter_all_owners")}</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <SegmentedFilter
          className="ml-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: tv("view_board"), icon: Columns3 },
            { value: "list", label: tv("view_list"), icon: List },
          ]}
        />
      </ListToolbar>

      {opportunities.length === 0 ? (
        <EmptyState>
          {tv("empty")}
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" />
            {tv("new_opportunity_long")}
          </Button>
        </EmptyState>
      ) : view === "board" ? (
        <>
          {/* Celular y tableta: una etapa a la vez. */}
          <div className="flex flex-col gap-2 lg:hidden">
            <SegmentedFilter
              fill
              value={mobileStage}
              onChange={setMobileStage}
              options={STAGES.map((s) => ({ value: s, label: `${tv(`stage_${s}`)} (${byStage.get(s)!.length})` }))}
            />
            {byStage.get(mobileStage)!.length === 0 ? <EmptyState>{tv("empty_stage")}</EmptyState> : byStage.get(mobileStage)!.map(card)}
          </div>

          {/* Computadora: las cinco columnas. */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-5">
            {STAGES.map((s) => {
              const list = byStage.get(s)!;
              const total = list.reduce((sum, o) => sum + (opportunityAmount(o) ?? 0), 0);
              return (
                <section
                  key={s}
                  className="flex min-w-0 flex-col gap-2 rounded-lg border-t-[3px] bg-muted/40 p-2"
                  style={{ borderTopColor: STAGE_META[s].color }}
                >
                  <header className="flex items-center justify-between gap-2 px-1 pt-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <StageIcon stage={s} />
                      {tv(`stage_${s}`)}
                      <span className="font-normal text-muted-foreground">{list.length}</span>
                    </span>
                    {total > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(total)}</span>}
                  </header>
                  {list.length === 0 ? <p className="px-1 py-4 text-center text-xs text-muted-foreground">{tv("empty_stage")}</p> : list.map(card)}
                </section>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{tv("closed_hidden")}</p>
        </>
      ) : (
        <OppList list={filtered} clients={clientById} today={today} onOpen={setEditing} />
      )}

      <OpportunityDialog
        opportunity={editingNow}
        clients={clients}
        people={people}
        driveEnabled={driveEnabled}
        currentUserId={people.some((p) => p.id === currentUserId) ? currentUserId : null}
        onClose={() => setEditing(null)}
        onApprove={(o) => {
          setEditing(null);
          setApproving(o);
        }}
      />
      <LostDialog
        opportunity={losing}
        onClose={() => setLosing(null)}
        onConfirm={async (reason, note) => {
          const o = losing!;
          setLosing(null);
          await move(o, "perdida", reason, note);
        }}
      />
      <ApproveDialog opportunity={approving} clients={clientById} projects={projects} onClose={() => setApproving(null)} />
    </div>
  );
}

/** Tarjeta del tablero: nombre, quiénes, monto, alerta y días en la etapa. */
function OppCard({
  o,
  clients,
  today,
  onOpen,
  onMove,
}: {
  o: Opportunity;
  clients: Map<string, Client>;
  today: string;
  onOpen: () => void;
  onMove: (stage: Stage) => void;
}) {
  const { tv, lang } = useTv();
  const title = opportunityTitle(o, clients);
  const people = o.title.trim() ? opportunityPeople(o, clients) : "";
  const amount = opportunityAmount(o);
  const alert = opportunityAlert(o, today);
  const closed = o.stage === "aprobada" || o.stage === "perdida";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-l-[3px] border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      style={{ borderLeftColor: STAGE_META[o.stage].color }}
    >
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug font-semibold text-foreground">{title}</span>
          {people && <span className="block truncate text-xs text-muted-foreground">{people}</span>}
        </span>
        <span onClick={(e) => e.stopPropagation()} className="-mt-1 -mr-1.5">
          <RowMenu
            label={tv("move_to")}
            items={STAGES.filter((s) => s !== o.stage).map((s) => ({
              label: `${tv("move_to")} ${tv(`stage_${s}`)}`,
              icon: STAGE_META[s].icon,
              iconColor: STAGE_META[s].color,
              onSelect: () => onMove(s),
            }))}
          />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("text-sm tabular-nums", amount == null ? "text-muted-foreground" : "font-medium text-foreground")}>
          {amount == null ? tv("no_amount") : formatMoney(amount)}
        </span>
        {alert && <Badge variant={alert === "vencida" ? "destructive" : "warning"}>{tv(`alert_${alert}`)}</Badge>}
        {o.stage === "perdida" && o.lostReason && <Badge variant="outline">{tv(`lost_${o.lostReason}`)}</Badge>}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        {o.ownerName && <span>{o.ownerName.split(" ")[0]}</span>}
        {!closed && <span>{tv("days_in_stage", { n: daysSince(o.stageChangedAt, today) })}</span>}
        {closed && o.closedOn && <span>{formatDateCompact(lang, o.closedOn)}</span>}
        {!closed && o.dueOn && o.stage !== "enviada" && (
          <span className="flex items-center gap-0.5">
            <CalendarClock className="size-3" />
            {tv("due_short", { d: formatDateCompact(lang, o.dueOn) })}
          </span>
        )}
      </p>
    </div>
  );
}

/** Lista: todas (también las cerradas viejas), lo más reciente primero. */
function OppList({
  list,
  clients,
  today,
  onOpen,
}: {
  list: Opportunity[];
  clients: Map<string, Client>;
  today: string;
  onOpen: (o: Opportunity) => void;
}) {
  const { tv, lang } = useTv();
  const rows = [...list].sort((a, b) => b.receivedOn.localeCompare(a.receivedOn) || b.createdAt.localeCompare(a.createdAt));
  if (rows.length === 0) return <EmptyState>{tv("no_results")}</EmptyState>;
  return (
    <>
      <ul className="flex flex-col gap-2 sm:hidden">
        {rows.map((o) => {
          const amount = opportunityAmount(o);
          const alert = opportunityAlert(o, today);
          return (
            <li key={o.id}>
              <button type="button" onClick={() => onOpen(o)} className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card px-3.5 py-3 text-left">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-foreground">{opportunityTitle(o, clients)}</span>
                  <StageBadge stage={o.stage} />
                  {alert && <Badge variant={alert === "vencida" ? "destructive" : "warning"}>{tv(`alert_${alert}`)}</Badge>}
                </span>
                {o.title.trim() && <span className="text-xs text-muted-foreground">{opportunityPeople(o, clients)}</span>}
                <span className="text-xs text-muted-foreground">
                  {formatDateCompact(lang, o.receivedOn)} · {amount == null ? tv("no_amount") : formatMoney(amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3.5 py-2 text-left font-medium">{tv("f_project")}</th>
              <th className="px-3 py-2 text-left font-medium">{tv("f_stage")}</th>
              <th className="px-3 py-2 text-left font-medium">{tv("f_received")}</th>
              <th className="px-3 py-2 text-left font-medium">{tv("f_owner")}</th>
              <th className="px-3.5 py-2 text-right font-medium">{tv("f_amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const amount = opportunityAmount(o);
              const alert = opportunityAlert(o, today);
              return (
                <tr key={o.id} onClick={() => onOpen(o)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="min-w-[260px] px-3.5 py-2">
                    <span className="block font-semibold text-foreground">{opportunityTitle(o, clients)}</span>
                    {o.title.trim() && <span className="block text-xs text-muted-foreground">{opportunityPeople(o, clients)}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-1">
                      <StageBadge stage={o.stage} />
                      {alert && <Badge variant={alert === "vencida" ? "destructive" : "warning"}>{tv(`alert_${alert}`)}</Badge>}
                      {o.stage === "perdida" && o.lostReason && <span className="text-xs text-muted-foreground">{tv(`lost_${o.lostReason}`)}</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDateCompact(lang, o.receivedOn)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{o.ownerName ?? "—"}</td>
                  <td className={cn("whitespace-nowrap px-3.5 py-2.5 text-right tabular-nums", amount == null && "text-muted-foreground")}>
                    {amount == null ? "—" : formatMoney(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
