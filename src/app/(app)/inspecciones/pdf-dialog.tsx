"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Download, Loader2, Share2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { t, strings } from "@/lib/i18n";
import { buildInspectionPdf, canShareFiles, inspectionPdfName, shareOrDownloadPdf, type InspectionPdfGroup } from "./inspection-pdf";
import { useTi } from "./shared";

/**
 * El PDF para el instalador o el pintor: sale con lo que se está viendo (el
 * agrupado y los filtros de la pantalla) o con los detalles seleccionados. Se
 * arma solo al abrir, así "Compartir" sale en el acto (el celular solo deja
 * compartir justo después del toque).
 */
export function PdfDialog({
  draft,
  onClose,
  project,
}: {
  /** null = cerrado. `lines`: qué incluye (filtros, agrupado), para el diálogo y el encabezado del PDF. */
  draft: { groups: InspectionPdfGroup[]; lines: string[] } | null;
  onClose: () => void;
  project: { name: string; clientName: string | null; location: string | null };
}) {
  const { ti, lang } = useTi();
  const [pdf, setPdf] = React.useState<Blob | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [share] = React.useState(canShareFiles);
  const total = draft?.groups.reduce((s, g) => s + g.items.length, 0) ?? 0;

  React.useEffect(() => {
    if (!draft || total === 0) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- arma el PDF de fondo */
    setPdf(null);
    setBuilding(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    buildInspectionPdf(draft.groups, {
      company: t(lang, strings.planilla.pdf_company),
      title: ti("pdf_doc_title"),
      project: project.name,
      subtitle: [project.clientName, project.location].filter(Boolean).join(" · "),
      generated: ti("pdf_generated", { date: formatDateCompact(lang, todayInPanama()) }),
      summary: [(total === 1 ? ti("pdf_count_1") : ti("pdf_count", { n: total })), ...draft.lines].join("\n"),
      page: ti("pdf_page"),
      noArea: ti("no_area"),
      noComment: ti("no_comment"),
      pending: ti("status_pendiente"),
      resolved: ti("status_resuelto"),
      after: ti("photo_after"),
      photoMissing: ti("pdf_photo_missing"),
    })
      .then((doc) => !cancelled && setPdf(doc.output("blob")))
      .catch((err) => {
        console.error("PDF de inspección", err);
        if (!cancelled) toast.error(ti("pdf_error"));
      })
      .finally(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se arma una vez por apertura
  }, [draft]);

  const ready = !building ? pdf : null;

  async function deliver(viaShare: boolean) {
    if (!ready) return;
    const r = await shareOrDownloadPdf(ready, inspectionPdfName(project.name, todayInPanama()), ti("pdf_share_text", { project: project.name }), viaShare);
    if (r !== "cancelled") onClose();
  }

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ti("pdf_title")}</DialogTitle>
          <DialogDescription>{ti("pdf_view")}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
          <li className="font-semibold text-foreground">{total === 0 ? ti("pdf_empty") : (total === 1 ? ti("pdf_count_1") : ti("pdf_count", { n: total }))}</li>
          {draft?.lines.map((l) => (
            <li key={l} className="text-muted-foreground">
              {l}
            </li>
          ))}
        </ul>
        {total > 0 && (building || !ready) && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {ti("pdf_building")}
          </p>
        )}
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
