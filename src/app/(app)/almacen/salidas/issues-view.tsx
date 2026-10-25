"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

import type { InventoryCategory, InventoryIssue, InventoryItem, InventoryPerson } from "@/types/almacen";
import { formatDateCompact } from "@/lib/planilla/format";
import { EmptyBox, ItemThumb, PageHeader, SearchBox, qtyWithUnit, useTa, useVariantIndex } from "../shared";
import { IssueShop } from "./issue-shop";

type Project = { id: string; name: string; active: boolean };

/** Salidas: la tienda para registrar una nueva (pestaña principal) y el historial. */
export function IssuesView({
  issues,
  items,
  categories,
  people,
  projects,
}: {
  issues: InventoryIssue[];
  items: InventoryItem[];
  categories: InventoryCategory[];
  people: InventoryPerson[];
  projects: Project[];
}) {
  const { ta, lang } = useTa();
  const [tab, setTab] = React.useState<"shop" | "history">("shop");
  const [open, setOpen] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const index = useVariantIndex(items);
  const personName = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const projectName = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const destination = React.useCallback(
    (i: InventoryIssue) => (i.projectId ? (projectName.get(i.projectId) ?? "—") : i.internalUse ? `${ta("dest_internal")} · ${ta(`use_${i.internalUse}`)}` : "—"),
    [projectName, ta],
  );

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((i) => {
      const who = personName.get(i.employeeId ?? i.contractorId ?? "")?.name ?? "";
      const what = i.lines.map((l) => index.get(l.variantId)?.name ?? "").join(" ");
      return `${who} ${destination(i)} ${what}`.toLowerCase().includes(q);
    });
  }, [issues, query, personName, index, destination]);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6">
      <PageHeader title={ta("issues_title")} subtitle={ta("issues_subtitle")} />

      <div className="flex gap-5 border-b border-ink-900/8">
        {(["shop", "history"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium ${tab === k ? "border-walnut text-walnut" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {k === "shop" ? ta("new_issue") : ta("history")}
          </button>
        ))}
      </div>

      {tab === "shop" ? (
        <IssueShop items={items} categories={categories} people={people} projects={projects} />
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
      </div>

      {shown.length === 0 ? (
        <EmptyBox>{issues.length === 0 ? ta("issues_empty") : ta("no_results")}</EmptyBox>
      ) : (
        <div className="overflow-x-auto border border-ink-900/8 bg-card">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                <th className="w-8" />
                <th className="px-3 py-2 text-left font-medium">{ta("date")}</th>
                <th className="px-3 py-2 text-left font-medium">{ta("col_recipient")}</th>
                <th className="px-3 py-2 text-left font-medium">{ta("col_destination")}</th>
                <th className="px-3 py-2 text-left font-medium">{ta("col_items")}</th>
                <th className="px-3.5 py-2 text-left font-medium">{ta("by")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const person = personName.get(i.employeeId ?? i.contractorId ?? "");
                const isOpen = open === i.id;
                const short = i.lines.some((l) => l.stockAfter < 0);
                return (
                  <React.Fragment key={i.id}>
                    <tr onClick={() => setOpen(isOpen ? null : i.id)} className="cursor-pointer border-b border-ink-900/8 hover:bg-muted/30">
                      <td className="pl-3 text-muted-foreground">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDateCompact(lang, i.issuedOn)}</td>
                      <td className="px-3 py-2.5">
                        <span className="block font-semibold text-foreground">{person?.name ?? "—"}</span>
                        <span className="block text-xs text-muted-foreground">{person ? ta(person.kind === "empleado" ? "employee" : "contractor") : ""}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{destination(i)}</td>
                      <td className="max-w-0 px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          {short && <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
                          <span className="truncate">
                            {i.lines.length === 1 ? (index.get(i.lines[0].variantId)?.name ?? ta("one_product")) : ta("n_products", { n: i.lines.length })}
                          </span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-muted-foreground">{i.createdByName ?? "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-ink-900/8 bg-muted/20">
                        <td />
                        <td colSpan={5} className="px-3 py-2.5">
                          <ul className="flex flex-col gap-1">
                            {i.lines.map((l) => {
                              const ref = index.get(l.variantId);
                              return (
                                <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-x-4">
                                  <span className="flex items-center gap-2">
                                    <ItemThumb path={ref?.item.photoPath ?? null} size={28} />
                                    {ref?.name ?? "—"}
                                  </span>
                                  <span className="tabular-nums">
                                    {qtyWithUnit(l.qty, ref?.item.unit, lang)}
                                    {l.stockAfter < 0 && <span className="ml-2 text-xs text-warning">({ta("status_out")})</span>}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {i.notes && <p className="mt-2 text-xs text-muted-foreground">{i.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

        </>
      )}
    </div>
  );
}
