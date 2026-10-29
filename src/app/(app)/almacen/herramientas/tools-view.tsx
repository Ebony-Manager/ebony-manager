"use client";

import * as React from "react";
import { HandHelping, Plus, Undo2 } from "lucide-react";

import { TOOL_CATEGORIES, type InventoryPerson, type Tool, type ToolLoan } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ListToolbar } from "@/components/shared/search-input";
import { PAGE_CLASS, ShowToggle } from "@/components/shared/page-header";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { compareTools, matchesToolFilter, openLoans, shownStatus, toolName, type ToolFilter } from "@/lib/almacen/tools";
import { EmptyBox, ItemThumb, PageHeader, SearchBox, useTa } from "../shared";
import { ToolStatusBadge, holderName, useDueText, type Project } from "./common";
import { ToolDialog } from "./tool-dialog";
import { LendDialog } from "./lend-dialog";
import { ReturnDialog } from "./return-dialog";

/**
 * Almacén → Herramientas: cada herramienta con su estado y, si está
 * prestada, quién la tiene, desde cuándo y hasta cuándo (sin fecha, 7 días).
 * Arriba lo que pide atención: las vencidas, luego las prestadas. Prestar
 * (una o varias a la vez) y Devolver son del Almacén; crear o editar, de
 * Ajustes de inventario o Compras.
 */
export function ToolsView({
  tools,
  loans,
  people,
  projects,
  canEdit,
}: {
  tools: Tool[];
  loans: ToolLoan[];
  people: InventoryPerson[];
  projects: Project[];
  canEdit: boolean;
}) {
  const { ta, lang } = useTa();
  const dueText = useDueText();
  const today = todayInPanama();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [filter, setFilter] = React.useState<ToolFilter>("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<Tool | "new" | null>(null);
  const [lending, setLending] = React.useState<string[] | null>(null);
  const [returning, setReturning] = React.useState<ToolLoan | null>(null);

  const open = React.useMemo(() => openLoans(loans), [loans]);
  const personById = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const projectName = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const all = React.useMemo(
    () =>
      tools
        .filter((t) => t.active || showInactive)
        .map((tool) => {
          const loan = open.get(tool.id);
          return { tool, loan, status: shownStatus(tool, loan, today) };
        }),
    [tools, open, today, showInactive],
  );
  const count = (f: ToolFilter) => all.filter((r) => matchesToolFilter(r.status, f)).length;

  const rows = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return all
      .filter((r) => category === "all" || r.tool.category === category)
      .filter((r) => matchesToolFilter(r.status, filter))
      .filter((r) => !q || matchesSearch(`${toolName(r.tool)} ${r.tool.brand ?? ""} ${r.loan ? holderName(r.loan, personById) : ""}`, q))
      .sort(compareTools);
  }, [all, query, category, filter, personById]);

  const available = tools.filter((t) => t.active && t.status === "disponible");
  const hasInactive = tools.some((t) => !t.active);
  const holder = (loan: ToolLoan) => [holderName(loan, personById), loan.projectId ? projectName.get(loan.projectId) : null].filter(Boolean).join(" · ");

  /** Prestar (disponible) o Devolver (prestada): el botón de cada fila. */
  const rowAction = (r: (typeof rows)[number], className?: string) =>
    r.loan ? (
      <Button
        size="sm"
        variant="outline"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setReturning(r.loan!);
        }}
      >
        <Undo2 className="size-3.5" />
        {ta("give_back")}
      </Button>
    ) : r.status === "disponible" && r.tool.active ? (
      <Button
        size="sm"
        variant="ghost"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setLending([r.tool.id]);
        }}
      >
        <HandHelping className="size-3.5" />
        {ta("lend")}
      </Button>
    ) : null;

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={ta("tools_title")}
        subtitle={ta("tools_subtitle")}
        action={
          <>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing("new")} aria-label={ta("new_tool")} title={ta("new_tool")}>
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">{ta("new_tool")}</span>
              </Button>
            )}
            <Button size="sm" onClick={() => setLending([])} disabled={available.length === 0}>
              <HandHelping className="size-3.5" />
              {ta("lend")}
            </Button>
          </>
        }
      />

      <ListToolbar>
        <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-auto min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ta("tool_cat_all")}</SelectItem>
            {TOOL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {ta(`tool_cat_${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={(["all", "stock", "lent", "overdue", "out"] as const)
            .filter((f) => f === "all" || f === filter || count(f) > 0)
            .map((f) => ({ value: f, label: `${ta(`tools_f_${f}`)} (${count(f)})` }))}
        />
      </ListToolbar>

      {tools.length === 0 ? (
        <EmptyBox>{canEdit ? ta("tools_empty_edit") : ta("tools_empty")}</EmptyBox>
      ) : rows.length === 0 ? (
        <EmptyBox>{ta("no_results")}</EmptyBox>
      ) : (
        <>
          {/* Celular: tarjetas. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map((r) => (
              <li key={r.tool.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditing(r.tool)}
                  onKeyDown={(e) => e.key === "Enter" && setEditing(r.tool)}
                  className={`flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left ${r.tool.active ? "" : "opacity-60"}`}
                >
                  <ItemThumb path={r.tool.photoPath} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{toolName(r.tool)}</span>
                      <ToolStatusBadge status={r.status} />
                    </span>
                    {r.loan ? (
                      <>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{holder(r.loan)}</span>
                        <span className={`block text-xs ${r.status === "vencida" ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {formatDateCompact(lang, r.loan.lentOn)} → {dueText(r.loan.dueOn, today)}
                        </span>
                      </>
                    ) : (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{[ta(`tool_cat_${r.tool.category}`), r.tool.brand].filter(Boolean).join(" · ")}</span>
                    )}
                  </span>
                  {rowAction(r, "shrink-0 self-center")}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3.5 py-2 text-left font-medium">{ta("col_tool")}</th>
                  <th className="px-3 py-2 text-left font-medium">{ta("col_status")}</th>
                  <th className="px-3 py-2 text-left font-medium">{ta("col_holder")}</th>
                  <th className="px-3 py-2 text-left font-medium">{ta("col_since")}</th>
                  <th className="px-3 py-2 text-left font-medium">{ta("col_due")}</th>
                  <th className="px-3.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.tool.id}
                    onClick={() => setEditing(r.tool)}
                    className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${r.tool.active ? "" : "opacity-60"}`}
                  >
                    <td className="min-w-[240px] px-3.5 py-2">
                      <span className="flex items-center gap-3">
                        <ItemThumb path={r.tool.photoPath} size={40} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-foreground">{toolName(r.tool)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[ta(`tool_cat_${r.tool.category}`), r.tool.brand].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ToolStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5">{r.loan ? holder(r.loan) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.loan ? formatDateCompact(lang, r.loan.lentOn) : "—"}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 ${r.status === "vencida" ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {r.loan ? dueText(r.loan.dueOn, today) : "—"}
                    </td>
                    <td className="px-3.5 py-2 text-right">{rowAction(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {hasInactive && <ShowToggle className="self-end" checked={showInactive} onChange={setShowInactive} label={ta("show_inactive")} />}

      <ToolDialog
        tool={editing}
        loans={loans}
        people={personById}
        projects={projectName}
        canEdit={canEdit}
        onClose={() => setEditing(null)}
        onReturn={(loan) => {
          setEditing(null);
          setReturning(loan);
        }}
        onLend={(id) => {
          setEditing(null);
          setLending([id]);
        }}
      />
      <LendDialog preselected={lending} tools={tools} people={people} projects={projects} onClose={() => setLending(null)} />
      <ReturnDialog loan={returning} tool={returning ? (tools.find((t) => t.id === returning.toolId) ?? null) : null} people={personById} onClose={() => setReturning(null)} />
    </div>
  );
}
