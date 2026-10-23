"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle, ChevronDown, ChevronRight, Plus, X } from "lucide-react";

import { INTERNAL_USES, type InternalUse, type InventoryCategory, type InventoryIssue, type InventoryItem, type InventoryPerson } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { parseQty } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { registerIssueAction } from "../actions";
import { Combo, EmptyBox, PageHeader, QtyInput, SearchBox, qtyWithUnit, useTa, useVariantIndex, useVariantOptions } from "../shared";

type Project = { id: string; name: string; active: boolean };

/** Salidas recientes y el botón grande de "Nueva salida" (pensado para el celular). */
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
  const [adding, setAdding] = React.useState(false);
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
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      <PageHeader
        title={ta("issues_title")}
        subtitle={ta("issues_subtitle")}
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {ta("new_issue")}
          </Button>
        }
      />

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
                                <li key={l.variantId} className="flex flex-wrap justify-between gap-x-4">
                                  <span>{ref?.name ?? "—"}</span>
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

      <IssueDialog open={adding} onOpenChange={setAdding} items={items} categories={categories} people={people} projects={projects} />
    </div>
  );
}

interface LineDraft {
  key: string;
  variantId: string | null;
  qty: string;
}

let seq = 0;
const newLine = (): LineDraft => ({ key: `l${++seq}`, variantId: null, qty: "" });

function IssueDialog({
  open,
  onOpenChange,
  items,
  categories,
  people,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  categories: InventoryCategory[];
  people: InventoryPerson[];
  projects: Project[];
}) {
  const { ta, lang } = useTa();
  const index = useVariantIndex(items);
  const catName = React.useCallback((id: string | null) => categories.find((c) => c.id === id)?.name ?? "", [categories]);
  const variantOptions = useVariantOptions(items, catName);

  const [date, setDate] = React.useState("");
  const [recipient, setRecipient] = React.useState<string | null>(null);
  const [destKind, setDestKind] = React.useState<"project" | "internal">("project");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [internalUse, setInternalUse] = React.useState<InternalUse>("taller");
  const [lines, setLines] = React.useState<LineDraft[]>([newLine()]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo cada vez que se abre. */
  React.useEffect(() => {
    if (!open) return;
    setDate(todayInPanama(new Date()));
    setRecipient(null);
    setDestKind("project");
    setProjectId(null);
    setInternalUse("taller");
    setLines([newLine()]);
    setNotes("");
    setError(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const personOptions = React.useMemo(
    () =>
      people
        .filter((p) => p.active)
        .map((p) => ({ value: `${p.kind}:${p.id}`, label: p.name, group: ta(p.kind === "empleado" ? "employee" : "contractor") })),
    [people, ta],
  );
  const projectOptions = React.useMemo(() => projects.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name })), [projects]);

  const patch = (key: string, p: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient) return setError(ta("recipient_required"));
    if (destKind === "project" && !projectId) return setError(ta("destination_required"));
    const parsed = lines
      .map((l) => ({ variantId: l.variantId, qty: parseQty(l.qty) }))
      .filter((l): l is { variantId: string; qty: number } => !!l.variantId && l.qty != null && l.qty > 0);
    if (parsed.length === 0) return setError(ta("lines_required"));
    for (const l of parsed) {
      const ref = index.get(l.variantId);
      if (ref && !ref.item.allowsDecimals && !Number.isInteger(l.qty)) return setError(`${ref.name}: ${ta("no_fraction")}`);
    }
    const [kind, id] = recipient.split(":") as ["empleado" | "contratista", string];
    setSaving(true);
    const res = await registerIssueAction({
      issuedOn: date || null,
      recipient: { kind, id },
      projectId: destKind === "project" ? projectId : null,
      internalUse: destKind === "internal" ? internalUse : null,
      notes,
      lines: parsed,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("issue_saved"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("new_issue")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
            <Field label={ta("f_recipient")}>
              <Combo options={personOptions} value={recipient} onChange={setRecipient} placeholder={ta("pick_person")} />
            </Field>
            <Field label={ta("date")}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <Field label={ta("f_destination")}>
            <div className="flex flex-col gap-2">
              <SegmentedFilter
                value={destKind}
                onChange={setDestKind}
                options={[
                  { value: "project", label: ta("dest_project") },
                  { value: "internal", label: ta("dest_internal") },
                ]}
              />
              {destKind === "project" ? (
                <Combo options={projectOptions} value={projectId} onChange={setProjectId} placeholder={ta("pick_project")} />
              ) : (
                <SegmentedFilter
                  value={internalUse}
                  onChange={setInternalUse}
                  options={INTERNAL_USES.map((u) => ({ value: u, label: ta(`use_${u}`) }))}
                />
              )}
            </div>
          </Field>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{ta("col_items")}</h3>
            {lines.map((l) => {
              const ref = l.variantId ? index.get(l.variantId) : undefined;
              const qty = parseQty(l.qty);
              const short = ref && qty != null && qty > ref.variant.stockQty;
              return (
                <div key={l.key} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[1fr_96px_28px] items-center gap-2">
                    <Combo options={variantOptions} value={l.variantId} onChange={(v) => patch(l.key, { variantId: v })} placeholder={ta("pick_product")} />
                    <QtyInput value={l.qty} onChange={(v) => patch(l.key, { qty: v })} placeholder={ta("qty")} aria-label={ta("qty")} />
                    <button
                      type="button"
                      title={ta("remove")}
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))}
                      className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {ref && (
                    <p className={`text-xs ${short ? "text-warning" : "text-muted-foreground"}`}>
                      {short
                        ? ta("short_stock", { stock: qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang) })
                        : `${ta("stock_now")}: ${qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}`}
                    </p>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="size-3.5" />
              {ta("add_line")}
            </Button>
          </div>

          <Field label={ta("notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ta("optional")} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : ta("new_issue")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
