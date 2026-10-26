"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Camera, Check, FileDown, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import type { Inspection, InspectionItem, InspectionPhoto } from "@/types/inspections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { RowMenu } from "@/components/shared/row-menu";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { allItems, areaSuggestions, countItems, visitsToShow } from "@/lib/inspections/view";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { t, strings } from "@/lib/i18n";
import { addInspectionPhotosAction, deleteInspectionAction, deleteInspectionItemAction, setInspectionItemStatusAction } from "./actions";
import { ItemDialog, PHOTO_MAX_SIDE, discardUploaded, uploadInspectionPhotos } from "./item-dialog";
import { PdfDialog, type InspectionView } from "./pdf-dialog";
import { VisitDialog } from "./visit-dialog";
import { PhotoThumb, PhotoViewer, useTi } from "./shared";

/**
 * Las inspecciones de un proyecto: por visita o todo junto, pendientes o
 * todos. La supervisora agrega visitas y detalles (fotos + área +
 * comentario), los marca resueltos y saca el PDF para el instalador. Se usa
 * en Inspecciones → proyecto y en la pestaña Inspecciones de la ficha.
 */
export function InspectionsBoard({
  project,
  inspections,
}: {
  project: { id: string; name: string; clientName: string | null; location: string | null };
  inspections: Inspection[];
}) {
  const { ti, lang } = useTi();
  const router = useRouter();
  const [view, setView] = React.useState<InspectionView>("visita");
  const [onlyPending, setOnlyPending] = React.useState(true);
  const [visitDialog, setVisitDialog] = React.useState<{ visit: Inspection | null } | null>(null);
  const [itemDialog, setItemDialog] = React.useState<{ inspectionId: string; item: InspectionItem | null } | null>(null);
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [viewer, setViewer] = React.useState<{ photos: InspectionPhoto[]; index: number } | null>(null);

  const counts = countItems(inspections);
  const areas = React.useMemo(() => areaSuggestions(inspections), [inspections]);
  const visits = visitsToShow(inspections, onlyPending);
  const flat = view === "junto" ? allItems(inspections, onlyPending) : [];
  const refresh = () => router.refresh();
  const date = (iso: string) => formatDateCompact(lang, iso);

  // Si la vista deja de tener lo que se agregó (ej. la visita nueva no tiene pendientes todavía), igual se ve.
  const visibleVisits = onlyPending
    ? inspections.filter((v) => v.items.length === 0 || visits.some((x) => x.id === v.id)).map((v) => visits.find((x) => x.id === v.id) ?? v)
    : visits;

  const itemProps = {
    onOpenPhoto: (photos: InspectionPhoto[], index: number) => setViewer({ photos, index }),
    onEdit: (item: InspectionItem) => setItemDialog({ inspectionId: item.inspectionId, item }),
    onChanged: refresh,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          value={view}
          onChange={setView}
          options={[
            { value: "visita", label: ti("view_by_visit") },
            { value: "junto", label: ti("view_all") },
          ]}
        />
        <SegmentedFilter
          value={onlyPending ? "p" : "t"}
          onChange={(v) => setOnlyPending(v === "p")}
          options={[
            { value: "p", label: `${ti("show_pending")} (${counts.pending})` },
            { value: "t", label: `${ti("show_all")} (${counts.pending + counts.resolved})` },
          ]}
        />
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setPdfOpen(true)} disabled={counts.pending + counts.resolved === 0}>
            <FileDown className="size-4" />
            {ti("pdf")}
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setVisitDialog({ visit: null })}>
            <Plus className="size-4" />
            {ti("new_visit")}
          </Button>
        </div>
      </div>

      {inspections.length === 0 ? (
        <EmptyState>
          <p>{ti("empty_visits")}</p>
          <Button size="sm" onClick={() => setVisitDialog({ visit: null })}>
            <Plus className="size-4" />
            {ti("new_visit")}
          </Button>
        </EmptyState>
      ) : view === "visita" ? (
        visibleVisits.length === 0 ? (
          <EmptyState>{ti("empty_pending")}</EmptyState>
        ) : (
          visibleVisits.map((v) => {
            const full = inspections.find((x) => x.id === v.id) ?? v;
            const pending = full.items.filter((i) => i.status === "pendiente").length;
            return (
              <Card key={v.id} className="gap-0 p-0">
                <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      {ti("visit_title", { date: date(v.visitedOn) })}
                      {pending > 0 ? (
                        <Badge variant="warning">{pending === 1 ? ti("pending_1") : ti("pending_n", { n: pending })}</Badge>
                      ) : full.items.length > 0 ? (
                        <Badge variant="success">{ti("status_resuelto")}</Badge>
                      ) : null}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {[v.createdByName ? ti("by", { name: v.createdByName }) : null, v.notes].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setItemDialog({ inspectionId: v.id, item: null })}>
                      <Plus className="size-4" />
                      <span className="hidden sm:inline">{ti("add_item")}</span>
                    </Button>
                    <RowMenu
                      label={ti("visit_menu")}
                      items={[
                        { label: ti("edit_visit"), icon: Pencil, onSelect: () => setVisitDialog({ visit: full }) },
                        {
                          label: ti("delete_visit"),
                          icon: Trash2,
                          confirmLabel: t(lang, strings.nav.confirm_delete),
                          onSelect: () =>
                            void deleteInspectionAction(v.id).then((r) => {
                              if (!r.ok) return toast.error(r.error);
                              toast.success(ti("deleted"));
                              refresh();
                            }),
                        },
                      ]}
                    />
                  </div>
                </div>
                {v.items.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setItemDialog({ inspectionId: v.id, item: null })}
                    className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Camera className="size-4" />
                    {ti("empty_visit")} {ti("add_item")}
                  </button>
                ) : (
                  <ul className="divide-y divide-border">
                    {v.items.map((item) => (
                      <ItemRow key={item.id} item={item} {...itemProps} />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })
        )
      ) : flat.length === 0 ? (
        <EmptyState>{ti("empty_pending")}</EmptyState>
      ) : (
        <Card className="gap-0 p-0">
          <ul className="divide-y divide-border">
            {flat.map((item) => (
              <ItemRow key={item.id} item={item} visitLabel={date(item.visitedOn)} {...itemProps} />
            ))}
          </ul>
        </Card>
      )}

      <VisitDialog
        open={!!visitDialog}
        projectId={project.id}
        visit={visitDialog?.visit ?? null}
        onClose={() => setVisitDialog(null)}
        onSaved={refresh}
        onCreated={(id) => setItemDialog({ inspectionId: id, item: null })}
      />
      <ItemDialog
        open={!!itemDialog}
        inspectionId={itemDialog?.inspectionId ?? null}
        item={itemDialog?.item ?? null}
        areas={areas}
        onClose={() => setItemDialog(null)}
        onSaved={refresh}
      />
      <PdfDialog open={pdfOpen} onClose={() => setPdfOpen(false)} project={project} inspections={inspections} defaultView={view} />
      <PhotoViewer photos={viewer?.photos ?? []} index={viewer?.index ?? null} onIndex={(i) => setViewer((v) => (v && i !== null ? { ...v, index: i } : null))} />
    </div>
  );
}

/** Un detalle: fotos, área, comentario, estado y acciones. */
function ItemRow({
  item,
  visitLabel,
  onOpenPhoto,
  onEdit,
  onChanged,
}: {
  item: InspectionItem;
  /** En "Todo junto": la fecha de su visita. */
  visitLabel?: string;
  onOpenPhoto: (photos: InspectionPhoto[], index: number) => void;
  onEdit: (item: InspectionItem) => void;
  onChanged: () => void;
}) {
  const { ti, lang } = useTi();
  const afterRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const resolved = item.status === "resuelto";

  async function toggle() {
    setBusy(true);
    const r = await setInspectionItemStatusAction(item.id, resolved ? "pendiente" : "resuelto");
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    onChanged();
  }

  async function onAfterPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let paths: string[] = [];
    try {
      const blobs = await Promise.all(files.map((f) => resizeToJpeg(f, PHOTO_MAX_SIDE)));
      paths = await uploadInspectionPhotos(item.inspectionId, blobs);
      const r = await addInspectionPhotosAction(item.id, paths, "despues");
      if (!r.ok) throw new Error(r.error);
      toast.success(ti("saved"));
      onChanged();
    } catch (err) {
      await discardUploaded(paths);
      toast.error(err instanceof Error && err.message ? err.message : ti("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`flex flex-col gap-2.5 px-4 py-3 ${resolved ? "bg-muted/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            {item.area || <span className="font-normal text-muted-foreground">{ti("no_area")}</span>}
            {visitLabel && <span className="text-xs font-normal text-muted-foreground">{visitLabel}</span>}
          </p>
          <p className={`text-sm whitespace-pre-wrap ${resolved ? "text-muted-foreground" : "text-foreground"}`}>
            {item.comment || <span className="text-muted-foreground">{ti("no_comment")}</span>}
          </p>
        </div>
        <RowMenu
          label={ti("item_menu")}
          items={[
            { label: ti("edit"), icon: Pencil, onSelect: () => onEdit(item) },
            { label: ti("add_after_photo"), icon: Camera, onSelect: () => afterRef.current?.click() },
            {
              label: ti("delete_item"),
              icon: Trash2,
              confirmLabel: t(lang, strings.nav.confirm_delete),
              onSelect: () =>
                void deleteInspectionItemAction(item.id).then((r) => {
                  if (!r.ok) return toast.error(r.error);
                  toast.success(ti("deleted"));
                  onChanged();
                }),
            },
          ]}
        />
      </div>

      {item.photos.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {item.photos.map((p, i) => (
            <PhotoThumb key={p.id} photo={p} onClick={() => onOpenPhoto(item.photos, i)} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {resolved ? (
          <>
            <Badge variant="success" className="gap-1">
              <Check className="size-3" />
              {ti("status_resuelto")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {[item.resolvedAt ? ti("resolved_on", { date: formatDateCompact(lang, todayInPanama(new Date(item.resolvedAt))) }) : null, item.resolvedByName]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto h-8 text-muted-foreground" disabled={busy} onClick={() => void toggle()}>
              <RotateCcw className="size-3.5" />
              {ti("mark_pending")}
            </Button>
          </>
        ) : (
          <>
            <Badge variant="warning">{ti("status_pendiente")}</Badge>
            <Button size="sm" variant="outline" className="ml-auto h-8" disabled={busy} onClick={() => void toggle()}>
              <Check className="size-3.5" />
              {ti("mark_resolved")}
            </Button>
          </>
        )}
      </div>
      <input ref={afterRef} type="file" accept="image/*" multiple className="hidden" onChange={onAfterPhotos} />
    </li>
  );
}
