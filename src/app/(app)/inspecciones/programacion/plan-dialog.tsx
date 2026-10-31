"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ClipboardCopy, Download, Share2 } from "lucide-react";

import type { InspectionItem, InspectionSchedule, ScheduleItem } from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { personPlan, planText } from "@/lib/inspections/schedule";
import { strings, t } from "@/lib/i18n";
import { Field } from "../../contratistas/field";
import { useDetailLine } from "../detail-fields";
import { buildInspectionPdf, canShareFiles, inspectionPdfName, shareOrDownloadPdf, type InspectionPdfGroup } from "../inspection-pdf";
import { useTi } from "../shared";
import { useDayLabel } from "./schedule-view";

/**
 * El plan de una persona para entregárselo: la semana o un día, por día y en
 * su orden, con la obra, el área, qué hacer, la nota y las fotos de antes.
 * PDF (descargar o compartir) o texto para WhatsApp.
 */
export function PlanDialog({
  open,
  onClose,
  days,
  schedules,
  items,
  defaultPerson,
}: {
  open: boolean;
  onClose: () => void;
  days: string[];
  schedules: InspectionSchedule[];
  items: ReadonlyMap<string, ScheduleItem>;
  defaultPerson: string | null;
}) {
  const { ti, lang } = useTi();
  const dayLabel = useDayLabel();
  const detailLine = useDetailLine();
  const [person, setPerson] = React.useState("");
  const [range, setRange] = React.useState("week");
  const [busy, setBusy] = React.useState(false);

  // Quienes tienen algo esta semana.
  const people = [...new Map(personPlanAll(schedules, days).map((s) => [s.personId, s.personName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  /* eslint-disable react-hooks/set-state-in-effect -- al abrir: la persona del filtro o la primera. */
  React.useEffect(() => {
    if (!open) return;
    setPerson(defaultPerson && people.some(([id]) => id === defaultPerson) ? defaultPerson : (people[0]?.[0] ?? ""));
    setRange("week");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const chosenDays = range === "week" ? days : [range];
  const plan = person ? personPlan(schedules, person, chosenDays) : [];
  const name = people.find(([id]) => id === person)?.[1] ?? "";
  const rangeLabel = range === "week" ? `${dayLabel(days[0], true)} – ${dayLabel(days[days.length - 1], true)}` : dayLabel(range, true);
  const title = `${ti("sch_plan_of", { name })} · ${rangeLabel}`;

  async function pdf(share: boolean) {
    if (!plan.length) return;
    setBusy(true);
    try {
      const groups: InspectionPdfGroup[] = [];
      for (const s of plan) {
        const it = items.get(s.itemId);
        if (!it) continue;
        const label = dayLabel(s.date, true);
        let g = groups[groups.length - 1];
        if (!g || g.title !== label) {
          g = { title: label, items: [] };
          groups.push(g);
        }
        const asItem: InspectionItem & { meta?: string; visitLabel?: string } = {
          id: it.id,
          inspectionId: "",
          area: `#${s.order} · ${it.area?.trim() || ti("no_area")}`,
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
          meta: [`${it.projectName}${it.location ? ` · ${it.location}` : ""}`, detailLine({ ...it, painterName: null }) || null].filter(Boolean).join(" · "),
          visitLabel: s.note ?? undefined,
        };
        g.items.push(asItem);
      }
      const doc = await buildInspectionPdf(groups, {
        company: t(lang, strings.planilla.pdf_company),
        title: ti("sch_plan_title"),
        project: ti("sch_plan_of", { name }),
        subtitle: rangeLabel,
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
      await navigator.clipboard.writeText(planText(title, plan, items, (iso) => dayLabel(iso, true)));
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
        {people.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{ti("sch_day_empty")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label={ti("sch_person")}>
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={ti("sch_pick_person")} />
                </SelectTrigger>
                <SelectContent>
                  {people.map(([id, n]) => (
                    <SelectItem key={id} value={id}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={ti("sch_plan_range")}>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm font-semibold text-foreground">
              {plan.length ? ti("sch_plan_count", { n: plan.length }) : ti("sch_plan_empty")}
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

/** Todas las programaciones (abiertas o hechas) de la semana, de cualquiera. */
function personPlanAll(schedules: readonly InspectionSchedule[], days: readonly string[]) {
  const set = new Set(days);
  return schedules.filter((s) => set.has(s.date) && (s.outcome === "programado" || s.outcome === "hecho"));
}
