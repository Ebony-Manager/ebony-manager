"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ClipboardCopy, Download, Share2 } from "lucide-react";

import type { InspectionItem, InspectionSchedule, ScheduleItem } from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { blockPeople, planSchedules, planSections, planText, type PlanTarget } from "@/lib/inspections/schedule";
import { strings, t } from "@/lib/i18n";
import { Field } from "../../contratistas/field";
import { useDetailLine } from "../detail-fields";
import { buildInspectionPdf, canShareFiles, inspectionPdfName, shareOrDownloadPdf, type InspectionPdfGroup } from "../inspection-pdf";
import { useTi } from "../shared";
import { useDayLabel } from "./schedule-view";

/** "p:<obra>" o "u:<persona>" → a quién va el plan. */
const toTarget = (v: string): PlanTarget => (v.startsWith("p:") ? { projectId: v.slice(2) } : v.startsWith("u:") ? { personId: v.slice(2) } : null);

/**
 * La agenda para entregar: de una obra (lo normal en obras grandes: día por
 * día, área por área, en su orden) o de una persona (aunque esté en varias
 * obras). La semana o un día. PDF (descargar o compartir) o texto para WhatsApp.
 */
export function PlanDialog({
  open,
  onClose,
  days,
  schedules,
  items,
  defaultTarget,
}: {
  open: boolean;
  onClose: () => void;
  days: string[];
  schedules: InspectionSchedule[];
  items: ReadonlyMap<string, ScheduleItem>;
  defaultTarget: string | null;
}) {
  const { ti, lang } = useTi();
  const dayLabel = useDayLabel();
  const detailLine = useDetailLine();
  const [target, setTarget] = React.useState("");
  const [range, setRange] = React.useState("week");
  const [busy, setBusy] = React.useState(false);

  // Obras y personas con algo esta semana.
  const week = planSchedules(schedules, items, null, days);
  const projects = [...new Map(week.map((s) => [items.get(s.itemId)?.projectId ?? "", items.get(s.itemId)?.projectName ?? ""])).entries()]
    .filter(([id]) => id)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const people = [...new Map(week.filter((s) => s.personId).map((s) => [s.personId!, s.personName ?? ""])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const options = [...projects.map(([id, n]) => [`p:${id}`, n] as const), ...people.map(([id, n]) => [`u:${id}`, n] as const)];

  /* eslint-disable react-hooks/set-state-in-effect -- al abrir: la obra o persona del filtro, o la primera obra. */
  React.useEffect(() => {
    if (!open) return;
    setTarget(defaultTarget && options.some(([v]) => v === defaultTarget) ? defaultTarget : (options[0]?.[0] ?? ""));
    setRange("week");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const chosenDays = range === "week" ? days : [range];
  const plan = target ? planSchedules(schedules, items, toTarget(target), chosenDays) : [];
  const name = options.find(([v]) => v === target)?.[1] ?? "";
  const isProject = target.startsWith("p:");
  const handles = isProject ? blockPeople(plan).names : [];
  const rangeLabel = range === "week" ? `${dayLabel(days[0], true)} – ${dayLabel(days[days.length - 1], true)}` : dayLabel(range, true);
  const heading = isProject ? ti("sch_plan_project", { name }) : ti("sch_plan_of", { name });
  const title = `${heading} · ${rangeLabel}`;

  async function pdf(share: boolean) {
    if (!plan.length) return;
    setBusy(true);
    try {
      const groups: InspectionPdfGroup[] = [];
      for (const day of planSections(plan, items)) {
        for (const b of day.blocks) {
          const first = items.get(b.schedules[0].itemId);
          const { names } = blockPeople(b.schedules);
          const notes = [...new Set(b.schedules.map((s) => s.note).filter(Boolean))].join(" · ");
          const titleParts = [dayLabel(day.date, true), isProject ? null : first?.projectName, b.area ?? ti("no_area"), names.length ? names.join(", ") : null];
          groups.push({
            title: titleParts.filter(Boolean).join(" · ") + (notes ? ` — ${notes}` : ""),
            items: b.schedules.flatMap((s): (InspectionItem & { meta?: string })[] => {
              const it = items.get(s.itemId);
              if (!it) return [];
              return [
                {
                  id: it.id,
                  inspectionId: "",
                  area: it.area?.trim() || ti("no_area"),
                  comment: it.comment,
                  kind: it.kind,
                  painterId: null,
                  painterName: null,
                  responsible: it.responsible,
                  thirdParty: it.thirdParty,
                  status: it.status,
                  resolvedAt: null,
                  resolvedByName: null,
                  createdAt: "",
                  photos: it.photos,
                  meta: [isProject ? null : it.location, detailLine({ ...it, painterName: null }) || null].filter(Boolean).join(" · ") || undefined,
                },
              ];
            }),
          });
        }
      }
      const location = isProject ? items.get(plan[0].itemId)?.location : null;
      const doc = await buildInspectionPdf(groups, {
        company: t(lang, strings.planilla.pdf_company),
        title: ti("sch_plan_title"),
        project: heading,
        subtitle: [rangeLabel, location, handles.length ? ti("sch_plan_handles", { names: handles.join(", ") }) : null].filter(Boolean).join(" · "),
        generated: ti("pdf_generated", { date: formatDateCompact(lang, todayInPanama()) }),
        summary: [ti("sch_plan_count", { n: plan.length }), `${ti("sch_plan_sign")}: ____________________________________________`].join("\n"),
        page: ti("pdf_page"),
        noArea: ti("no_area"),
        noComment: ti("no_comment"),
        pending: ti("status_pendiente"),
        resolved: ti("status_resuelto"),
        after: ti("photo_after"),
        photoMissing: ti("pdf_photo_missing"),
      });
      const fileName = inspectionPdfName(`plan ${name}`, range === "week" ? days[0] : range);
      const r = await shareOrDownloadPdf(doc.output("blob"), fileName, title, share);
      if (r !== "cancelled") onClose();
    } catch (err) {
      console.error("Plan PDF", err);
      toast.error(ti("pdf_error"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      const head = handles.length ? `${title}\n${ti("sch_plan_handles", { names: handles.join(", ") })}` : title;
      await navigator.clipboard.writeText(planText(head, plan, items, (iso) => dayLabel(iso, true), { noArea: ti("no_area") }));
      toast.success(ti("sch_plan_copied"));
    } catch {
      toast.error(ti("pdf_error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ti("sch_plan_title")}</DialogTitle>
          <DialogDescription>{rangeLabel}</DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{ti("sch_day_empty")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label={ti("sch_plan_target")}>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="w-full">
                  <SelectValue>{name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{ti("sch_plan_projects")}</SelectLabel>
                      {projects.map(([id, n]) => (
                        <SelectItem key={id} value={`p:${id}`}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {people.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{ti("sch_plan_people")}</SelectLabel>
                      {people.map(([id, n]) => (
                        <SelectItem key={id} value={`u:${id}`}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label={ti("sch_plan_range")}>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-full">
                  <SelectValue>{range === "week" ? ti("sch_plan_week") : <span className="capitalize">{dayLabel(range, true)}</span>}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">{ti("sch_plan_week")}</SelectItem>
                  {days.map((d) => (
                    <SelectItem key={d} value={d}>
                      <span className="capitalize">{dayLabel(d, true)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
              <span className="font-semibold">{plan.length ? ti("sch_plan_count", { n: plan.length }) : ti("sch_plan_empty")}</span>
              {handles.length > 0 && <span className="block text-xs text-muted-foreground">{ti("sch_plan_handles", { names: handles.join(", ") })}</span>}
            </p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={!plan.length} onClick={() => void copy()}>
            <ClipboardCopy className="size-4" />
            {ti("sch_plan_whatsapp")}
          </Button>
          <div className="flex gap-2">
            {canShareFiles() && (
              <Button variant="outline" disabled={!plan.length || busy} onClick={() => void pdf(true)}>
                <Share2 className="size-4" />
                {ti("sch_plan_share")}
              </Button>
            )}
            <Button disabled={!plan.length || busy} onClick={() => void pdf(false)}>
              <Download className="size-4" />
              {busy ? ti("pdf_building") : ti("sch_plan_pdf")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
