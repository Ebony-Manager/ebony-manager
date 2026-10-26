"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft, ChevronRight, FileDown, ImageOff, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

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
import { PhotoViewer, useTi } from "./shared";

/**
 * Las inspecciones de un proyecto: por visita o todo junto, pendientes o
 * todos. La supervisora agrega visitas y detalles (fotos + área +
 * comentario), los marca resueltos y saca el PDF para el instalador. Se usa
 * en Inspecciones → proyecto y en la pestaña Inspecciones de la ficha.
 */
export function InspectionsBoard({
  project,
  inspections,
  startNew = false,
}: {
  project: { id: string; name: string; clientName: string | null; location: string | null };
  inspections: Inspection[];
  /** Al entrar, empezar a inspeccionar: si ya hay visita de hoy se le agregan detalles; si no, una visita nueva. */
  startNew?: boolean;
}) {
  const { ti, lang } = useTi();
  const router = useRouter();
  const [view, setView] = React.useState<InspectionView>("visita");
  const [onlyPending, setOnlyPending] = React.useState(true);
  // Con startNew se arranca con un diálogo abierto: detalles de la visita de hoy, o una visita nueva.
  const [todayVisit] = React.useState(() => (startNew ? inspections.find((v) => v.visitedOn === todayInPanama()) : undefined));
  const [visitDialog, setVisitDialog] = React.useState<{ visit: Inspection | null } | null>(startNew && !todayVisit ? { visit: null } : null);
  const [itemDialog, setItemDialog] = React.useState<{ inspectionId: string; item: InspectionItem | null } | null>(
    todayVisit ? { inspectionId: todayVisit.id, item: null } : null,
  );
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [viewer, setViewer] = React.useState<{ photos: InspectionPhoto[]; index: number } | null>(null);

  // Sin el ?nueva=1, para que recargar no lo vuelva a abrir.
  React.useEffect(() => {
    if (startNew) router.replace(window.location.pathname, { scroll: false });
  }, [startNew, router]);

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
                  <ul className={`${GRID} p-3`}>
                    {v.items.map((item) => (
                      <ItemCard key={item.id} item={item} {...itemProps} />
                    ))}
                    <li>
                      <button
                        type="button"
                        onClick={() => setItemDialog({ inspectionId: v.id, item: null })}
                        className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
                      >
                        <Camera className="size-5" />
                        {ti("add_item")}
                      </button>
                    </li>
                  </ul>
                )}
              </Card>
            );
          })
        )
      ) : flat.length === 0 ? (
        <EmptyState>{ti("empty_pending")}</EmptyState>
      ) : (
        <ul className={GRID}>
          {flat.map((item) => (
            <ItemCard key={item.id} item={item} visitLabel={date(item.visitedOn)} {...itemProps} />
          ))}
        </ul>
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

/** Los detalles en tarjetitas: 2 por fila en el celular, más en pantallas grandes. */
const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/** Un detalle en tarjetita: fotos (carrusel), área, comentario, estado y acciones. */
function ItemCard({
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

  async function setStatus(next: "pendiente" | "resuelto") {
    setBusy(true);
    const r = await setInspectionItemStatusAction(item.id, next);
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

  const resolvedOn = item.resolvedAt ? formatDateCompact(lang, todayInPanama(new Date(item.resolvedAt))) : null;

  return (
    <li className={`flex flex-col overflow-hidden rounded-lg border bg-card ${resolved ? "border-success/30" : "border-border"}`}>
      <div className="relative">
        <PhotoCarousel photos={item.photos} onOpen={(i) => onOpenPhoto(item.photos, i)} onEmpty={() => onEdit(item)} dimmed={resolved} />
        <Badge variant={resolved ? "success" : "warning"} className="pointer-events-none absolute top-1.5 left-1.5 gap-1 bg-card/90 shadow-sm backdrop-blur">
          {resolved && <Check className="size-3" />}
          {resolved ? ti("status_resuelto") : ti("status_pendiente")}
        </Badge>
        <div className="absolute top-1 right-1 rounded-md bg-card/85 shadow-sm backdrop-blur">
          <RowMenu
            label={ti("item_menu")}
            items={[
              { label: ti("edit"), icon: Pencil, onSelect: () => onEdit(item) },
              { label: ti("add_after_photo"), icon: Camera, onSelect: () => afterRef.current?.click() },
              ...(resolved ? [{ label: ti("mark_pending"), icon: RotateCcw, onSelect: () => void setStatus("pendiente") }] : []),
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
      </div>

      <button type="button" onClick={() => onEdit(item)} className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2 pb-1.5 text-left">
        <span className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-tight font-semibold text-foreground">
          {item.area || <span className="font-normal text-muted-foreground">{ti("no_area")}</span>}
          {visitLabel && <span className="text-[11px] font-normal text-muted-foreground">{visitLabel}</span>}
        </span>
        <span className={`line-clamp-3 text-xs leading-snug ${resolved ? "text-muted-foreground" : "text-foreground"}`}>
          {item.comment || <span className="text-muted-foreground">{ti("no_comment")}</span>}
        </span>
      </button>

      <div className="px-2.5 pb-2.5">
        {resolved ? (
          <p className="truncate text-[11px] text-success" title={[resolvedOn, item.resolvedByName].filter(Boolean).join(" · ")}>
            {[resolvedOn ? ti("resolved_on", { date: resolvedOn }) : ti("status_resuelto"), item.resolvedByName].filter(Boolean).join(" · ")}
          </p>
        ) : (
          <Button size="sm" variant="outline" className="h-8 w-full text-xs" disabled={busy} onClick={() => void setStatus("resuelto")}>
            <Check className="size-3.5" />
            {ti("mark_resolved")}
          </Button>
        )}
      </div>
      <input ref={afterRef} type="file" accept="image/*" multiple className="hidden" onChange={onAfterPhotos} />
    </li>
  );
}

/**
 * Las fotos de un detalle, de a una, deslizando (en la computadora, flechas
 * al pasar el mouse) con puntitos abajo. Tocar abre en grande.
 */
function PhotoCarousel({
  photos,
  onOpen,
  onEmpty,
  dimmed,
}: {
  photos: InspectionPhoto[];
  onOpen: (index: number) => void;
  onEmpty: () => void;
  dimmed: boolean;
}) {
  const { ti } = useTi();
  const ref = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);

  if (photos.length === 0) {
    return (
      <button type="button" onClick={onEmpty} className="relative block w-full bg-muted pb-[75%] text-muted-foreground">
        <ImageOff className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2" />
      </button>
    );
  }

  const go = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, index + d));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    // Caja 4:3 con padding (no aspect-ratio) y las fotos en posición absoluta: el
    // Safari de iPhones con iOS más viejo no resuelve el alto 100% dentro de una
    // caja con aspect-ratio y dibujaba la foto a tamaño real, saliéndose.
    <div className="group relative w-full overflow-hidden bg-muted pb-[75%]">
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => onOpen(i)} className="relative h-full w-full min-w-full shrink-0 snap-center overflow-hidden">
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada del bucket privado
              <img src={p.url} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${dimmed ? "opacity-75" : ""}`} />
            ) : (
              <ImageOff className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
            {p.kind === "despues" && (
              <span className="absolute bottom-0 left-0 rounded-tr-md bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">{ti("photo_after")}</span>
            )}
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {photos.map((p, i) => (
              <span key={p.id} className={`size-1.5 rounded-full shadow ${i === index ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={ti("photo_prev")}
              className="absolute top-1/2 left-1 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white group-hover:flex"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {index < photos.length - 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={ti("photo_next")}
              className="absolute top-1/2 right-1 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white group-hover:flex"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
