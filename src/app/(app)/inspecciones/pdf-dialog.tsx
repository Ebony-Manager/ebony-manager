"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Download, Loader2, Share2 } from "lucide-react";

import type { Inspection } from "@/types/inspections";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { allItems, countItems, visitsToShow } from "@/lib/inspections/view";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { t, strings } from "@/lib/i18n";
import { buildInspectionPdf, canShareFiles, inspectionPdfName, shareOrDownloadPdf, type InspectionPdfGroup } from "./inspection-pdf";
import { useTi } from "./shared";

export type InspectionView = "visita" | "junto";

/**
 * El PDF para el instalador: nace con lo pendiente (se puede incluir todo),
 * por visita o todo junto. Se arma solo al abrir y al cambiar una opción, así
 * "Compartir" sale en el acto (el celular solo deja compartir justo después
 * del toque).
 */
export function PdfDialog({
  open,
  onClose,
  project,
  inspections,
  defaultView,
}: {
  open: boolean;
  onClose: () => void;
  project: { name: string; clientName: string | null; location: string | null };
  inspections: Inspection[];
  defaultView: InspectionView;
}) {
  const { ti, lang } = useTi();
  const [onlyPending, setOnlyPending] = React.useState(true);
  const [view, setView] = React.useState<InspectionView>(defaultView);
  const [pdf, setPdf] = React.useState<{ blob: Blob; key: string } | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [share] = React.useState(canShareFiles);

  /* eslint-disable react-hooks/set-state-in-effect -- opciones por defecto al abrir */
  React.useEffect(() => {
    if (!open) return;
    setOnlyPending(true);
    setView(defaultView);
  }, [open, defaultView]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const date = (iso: string) => formatDateCompact(lang, iso);
  const counts = countItems(inspections);
  const groups = React.useMemo<InspectionPdfGroup[]>(() => {
    // En el PDF, de la visita más vieja a la más nueva (la numeración sigue la obra).
    const visits = [...visitsToShow(inspections, onlyPending)].reverse();
    if (view === "visita") {
      return visits.map((v) => ({
        title: [t(lang, strings.inspecciones.pdf_visit).replace("{date}", formatDateCompact(lang, v.visitedOn)), v.notes].filter(Boolean).join(" · "),
        items: v.items,
      }));
    }
    const items = allItems(inspections, onlyPending).map((i) => ({
      ...i,
      visitLabel: t(lang, strings.inspecciones.pdf_visit).replace("{date}", formatDateCompact(lang, i.visitedOn)),
    }));
    return items.length ? [{ title: "", items }] : [];
  }, [inspections, onlyPending, view, lang]);
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const key = `${onlyPending}-${view}-${lang}`;

  React.useEffect(() => {
    if (!open || total === 0) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- arma el PDF de fondo
    setBuilding(true);
    const today = todayInPanama();
    buildInspectionPdf(groups, {
      company: t(lang, strings.planilla.pdf_company),
      title: ti("pdf_doc_title"),
      project: project.name,
      subtitle: [project.clientName, project.location].filter(Boolean).join(" · "),
      generated: ti("pdf_generated", { date: date(today) }),
      summary: onlyPending
        ? ti("pdf_summary_pending", { n: total })
        : ti("pdf_summary_all", { n: total, pending: counts.pending, resolved: counts.resolved }),
      page: ti("pdf_page"),
      noArea: ti("no_area"),
      noComment: ti("no_comment"),
      pending: ti("status_pendiente"),
      resolved: ti("status_resuelto"),
      after: ti("photo_after"),
      photoMissing: ti("pdf_photo_missing"),
    })
      .then((doc) => !cancelled && setPdf({ blob: doc.output("blob"), key }))
      .catch((err) => {
        console.error("PDF de inspección", err);
        if (!cancelled) toast.error(ti("pdf_error"));
      })
      .finally(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se rearma solo cuando cambian las opciones o los datos
  }, [open, groups, key]);

  const ready = pdf?.key === key && !building ? pdf.blob : null;
  const fileName = inspectionPdfName(project.name, todayInPanama());

  async function deliver(viaShare: boolean) {
    if (!ready) return;
    const r = await shareOrDownloadPdf(ready, fileName, ti("pdf_share_text", { project: project.name }), viaShare);
    if (r !== "cancelled") onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ti("pdf_title")}</DialogTitle>
          <DialogDescription>{ti("pdf_hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{ti("pdf_content")}</Label>
            <SegmentedFilter
              fill
              value={onlyPending ? "p" : "t"}
              onChange={(v) => setOnlyPending(v === "p")}
              options={[
                { value: "p", label: `${ti("pdf_pending")} (${counts.pending})` },
                { value: "t", label: `${ti("pdf_everything")} (${counts.pending + counts.resolved})` },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{ti("pdf_layout")}</Label>
            <SegmentedFilter
              fill
              value={view}
              onChange={setView}
              options={[
                { value: "visita", label: ti("view_by_visit") },
                { value: "junto", label: ti("view_all") },
              ]}
            />
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {total === 0 ? (
              ti("pdf_empty")
            ) : building || !ready ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {ti("pdf_building")}
              </>
            ) : (
              ti("pdf_count", { n: total })
            )}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant={share ? "outline" : "default"} disabled={!ready} onClick={() => void deliver(false)}>
            <Download className="size-4" />
            {ti("pdf_download")}
          </Button>
          {share && (
            <Button disabled={!ready} onClick={() => void deliver(true)}>
              <Share2 className="size-4" />
              {ti("pdf_share")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
