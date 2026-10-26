"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Camera, Check, CheckSquare, ChevronLeft, ChevronRight, FileDown, ImageOff, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";

import type { Inspection, InspectionItem, InspectionPainter, InspectionPhoto } from "@/types/inspections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/page-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { RowMenu } from "@/components/shared/row-menu";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { DEFAULT_FILTERS, areaSuggestions, countItems, groupItems, hasExtraFilters, type GroupBy, type ItemFilters, type ItemGroup } from "@/lib/inspections/view";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { addInspectionPhotosAction, deleteInspectionAction, deleteInspectionItemAction, setInspectionItemStatusAction } from "./actions";
import { BatchDialog } from "./batch-dialog";
import { DetailTags, KIND_KEY, useDetailLine } from "./detail-fields";
import type { InspectionPdfGroup } from "./inspection-pdf";
import { ItemDialog, PHOTO_MAX_SIDE, discardUploaded, uploadInspectionPhotos } from "./item-dialog";
import { PdfDialog } from "./pdf-dialog";
import { VisitDialog } from "./visit-dialog";
import { PhotoViewer, useTi } from "./shared";

/**
 * Las inspecciones de un proyecto: agrupadas por visita, por área o todo
 * junto, con filtros (pendientes, tipo, pintor, responsable). La supervisora
 * agrega visitas y detalles (de a varios por área), los marca resueltos y saca
 * el PDF de lo que está viendo, o solo de los que seleccione. Se usa en
 * Inspecciones → proyecto y en la pestaña Inspecciones de la ficha.
 */
export function InspectionsBoard({
  project,
  inspections,
  painters,
  startNew = false,
}: {
  project: { id: string; name: string; clientName: string | null; location: string | null };
  inspections: Inspection[];
  painters: InspectionPainter[];
  /** Al entrar, empezar a inspeccionar: si ya hay visita de hoy se le agregan detalles; si no, una visita nueva. */
  startNew?: boolean;
}) {
  const { ti, lang } = useTi();
  const router = useRouter();
  const detailLine = useDetailLine();
  const [groupBy, setGroupBy] = React.useState<GroupBy>("visita");
  const [filters, setFilters] = React.useState<ItemFilters>(DEFAULT_FILTERS);
  // Con startNew se arranca con un diálogo abierto: detalles de la visita de hoy, o una visita nueva.
  const [todayVisit] = React.useState(() => (startNew ? inspections.find((v) => v.visitedOn === todayInPanama()) : undefined));
  const [visitDialog, setVisitDialog] = React.useState<{ visit: Inspection | null } | null>(startNew && !todayVisit ? { visit: null } : null);
  const [batchFor, setBatchFor] = React.useState<string | null>(todayVisit?.id ?? null);
  const [editing, setEditing] = React.useState<InspectionItem | null>(null);
  const [pdf, setPdf] = React.useState<{ groups: InspectionPdfGroup[]; lines: string[] } | null>(null);
  const [viewer, setViewer] = React.useState<{ photos: InspectionPhoto[]; index: number } | null>(null);
  const [selected, setSelected] = React.useState<Set<string> | null>(null);

  // Sin el ?nueva=1, para que recargar no lo vuelva a abrir.
  React.useEffect(() => {
    if (startNew) router.replace(window.location.pathname, { scroll: false });
  }, [startNew, router]);

  const counts = countItems(inspections);
  const areas = React.useMemo(() => areaSuggestions(inspections), [inspections]);
  const groups = React.useMemo(() => groupItems(inspections, filters, groupBy), [inspections, filters, groupBy]);
  const shownIds = groups.flatMap((g) => g.items.map((i) => i.id));
  const refresh = () => router.refresh();
  const date = (iso: string) => formatDateCompact(lang, iso);
  const setFilter = (patch: Partial<ItemFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const painterName = (id: string) => painters.find((p) => p.id === id)?.name ?? "";

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Qué incluye lo que se ve (para el PDF). */
  function viewLines(selection: boolean): string[] {
    const lines: string[] = [];
    if (selection) lines.push(ti("pdf_selected_label"));
    lines.push(filters.onlyPending ? ti("show_pending") : ti("status_all"));
    if (filters.kind !== "todos") lines.push(`${ti("f_kind")}: ${filters.kind === "sin" ? ti("kind_sin") : ti(KIND_KEY[filters.kind])}`);
    if (filters.painterId !== "todos") lines.push(`${ti("f_painter")}: ${painterName(filters.painterId)}`);
    if (filters.responsible !== "todos") lines.push(`${ti("f_responsible")}: ${ti(filters.responsible === "ebony" ? "resp_ebony" : "resp_tercero")}`);
    lines.push(ti("pdf_grouped", { g: ti(groupBy === "visita" ? "view_by_visit" : groupBy === "area" ? "group_area" : "view_all") }));
    return [lines.join(" · ")];
  }

  /** Los grupos de la pantalla, listos para el PDF (de la visita más vieja a la más nueva, para numerar en orden). */
  function openPdf(only?: Set<string>) {
    const source = groupBy === "visita" ? [...groups].reverse() : groups;
    const pdfGroups: InspectionPdfGroup[] = source
      .map((g) => ({
        title: groupTitle(g, true),
        items: g.items
          .filter((i) => !only || only.has(i.id))
          .map((i) => ({ ...i, meta: detailLine(i) || undefined, visitLabel: groupBy === "visita" ? undefined : ti("pdf_visit", { date: date(i.visitedOn) }) })),
      }))
      .filter((g) => g.items.length > 0);
    setPdf({ groups: pdfGroups, lines: viewLines(!!only) });
  }

  function groupTitle(g: ItemGroup, forPdf = false): string {
    if (groupBy === "visita" && g.visit) {
      const base = forPdf ? ti("pdf_visit", { date: date(g.visit.visitedOn) }) : ti("visit_title", { date: date(g.visit.visitedOn) });
      return [base, forPdf ? g.visit.notes : null].filter(Boolean).join(" · ");
    }
    if (groupBy === "area") return g.title ?? ti("no_area");
    return "";
  }

  const itemProps = {
    onOpenPhoto: (photos: InspectionPhoto[], index: number) => setViewer({ photos, index }),
    onEdit: (item: InspectionItem) => setEditing(item),
    onChanged: refresh,
    selecting: !!selected,
    onToggle: toggle,
  };

  return (
    <div className="flex flex-col gap-3 pb-16 sm:pb-0">
      {/* Una sola fila: cómo agrupar y, a la derecha, filtros, seleccionar, PDF (y en computadora, Nueva visita). */}
      {selected ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-card px-3 py-2 shadow-sm">
          <span className="text-sm font-semibold">{ti("selected_n", { n: selected.size })}</span>
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setSelected(new Set(shownIds))}>
            {ti("select_all")}
          </button>
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setSelected(new Set())}>
            {ti("select_none")}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" disabled={selected.size === 0} onClick={() => openPdf(selected)}>
              <FileDown className="size-4" />
              {ti("pdf")} ({selected.size})
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setSelected(null)} aria-label={ti("cancel")} title={ti("cancel")}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <SegmentedFilter
            className="min-w-0"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "visita", label: ti("g_visit_short") },
              { value: "area", label: ti("g_area_short") },
              { value: "junto", label: ti("g_all_short") },
            ]}
          />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <FiltersButton filters={filters} counts={counts} painters={painters} onChange={setFilter} onClear={() => setFilters(DEFAULT_FILTERS)} />
            <IconAction label={ti("select")} icon={CheckSquare} disabled={shownIds.length === 0} onClick={() => setSelected(new Set())} />
            <IconAction label={ti("pdf")} icon={FileDown} disabled={shownIds.length === 0} onClick={() => openPdf()} />
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => setVisitDialog({ visit: null })}>
              <Plus className="size-4" />
              {ti("new_visit")}
            </Button>
          </div>
        </div>
      )}

      {/* Solo lo que cambia lo que se ve: chips que se quitan con un toque. */}
      <ActiveFilters filters={filters} painterName={painterName} onChange={setFilter} />

      {/* Celular: Nueva visita como botón flotante, sobre la barra de abajo. */}
      {!selected && (
        <Button
          size="icon"
          onClick={() => setVisitDialog({ visit: null })}
          aria-label={ti("new_visit")}
          title={ti("new_visit")}
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg sm:hidden"
        >
          <Plus className="size-6" />
        </Button>
      )}

      {inspections.length === 0 ? (
        <EmptyState>
          <p>{ti("empty_visits")}</p>
          <Button size="sm" onClick={() => setVisitDialog({ visit: null })}>
            <Plus className="size-4" />
            {ti("new_visit")}
          </Button>
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState>{hasExtraFilters(filters) ? ti("empty_filtered") : ti("empty_pending")}</EmptyState>
      ) : groupBy === "visita" ? (
        groups.map((g) => {
          const v = g.visit!;
          const pending = v.items.filter((i) => i.status === "pendiente").length;
          return (
            <Card key={g.key} className="gap-0 p-0">
              <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {groupTitle(g)}
                    {pending > 0 ? (
                      <Badge variant="warning">{pending === 1 ? ti("pending_1") : ti("pending_n", { n: pending })}</Badge>
                    ) : v.items.length > 0 ? (
                      <Badge variant="success">{ti("status_resuelto")}</Badge>
                    ) : null}
                  </h3>
                  <p className="text-xs text-muted-foreground">{[v.createdByName ? ti("by", { name: v.createdByName }) : null, v.notes].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setBatchFor(v.id)}>
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">{ti("add_item")}</span>
                  </Button>
                  <RowMenu
                    label={ti("visit_menu")}
                    items={[
                      { label: ti("edit_visit"), icon: Pencil, onSelect: () => setVisitDialog({ visit: v }) },
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
              {g.items.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setBatchFor(v.id)}
                  className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Camera className="size-4" />
                  {ti("empty_visit")} {ti("add_item")}
                </button>
              ) : (
                <ul className={`${GRID} p-3`}>
                  {g.items.map((item) => (
                    <ItemCard key={item.id} item={item} selected={!!selected?.has(item.id)} {...itemProps} />
                  ))}
                  {!selected && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setBatchFor(v.id)}
                        className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
                      >
                        <Camera className="size-5" />
                        {ti("add_item")}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </Card>
          );
        })
      ) : (
        groups.map((g) => {
          const pending = g.items.filter((i) => i.status === "pendiente").length;
          return (
            <section key={g.key} className="flex flex-col gap-2">
              {groupBy === "area" && (
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {groupTitle(g)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {g.items.length}
                    {pending > 0 && pending !== g.items.length ? ` · ${pending === 1 ? ti("pending_1") : ti("pending_n", { n: pending })}` : ""}
                  </span>
                </h3>
              )}
              <ul className={GRID}>
                {g.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    visitLabel={date(item.visitedOn)}
                    showArea={groupBy !== "area"}
                    selected={!!selected?.has(item.id)}
                    {...itemProps}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <VisitDialog
        open={!!visitDialog}
        projectId={project.id}
        visit={visitDialog?.visit ?? null}
        onClose={() => setVisitDialog(null)}
        onSaved={refresh}
        onCreated={(id) => setBatchFor(id)}
      />
      <BatchDialog inspectionId={batchFor} areas={areas} painters={painters} onClose={() => setBatchFor(null)} onSaved={refresh} />
      <ItemDialog item={editing} areas={areas} painters={painters} onClose={() => setEditing(null)} onSaved={refresh} />
      <PdfDialog draft={pdf} onClose={() => setPdf(null)} project={project} />
      <PhotoViewer photos={viewer?.photos ?? []} index={viewer?.index ?? null} onIndex={(i) => setViewer((v) => (v && i !== null ? { ...v, index: i } : null))} />
    </div>
  );
}

/** Botón de solo ícono (con su nombre para lectores de pantalla y al pasar el mouse). */
function IconAction({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof FileDown; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="icon" variant="outline" className="size-9" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon className="size-4" />
    </Button>
  );
}

/** Pastillas de a una (estado, tipo, responsable) dentro del panel de filtros. */
function Pills<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** El embudo: estado, tipo, pintor y responsable en un panel; el puntito dice cuántos hay puestos. */
function FiltersButton({
  filters,
  counts,
  painters,
  onChange,
  onClear,
}: {
  filters: ItemFilters;
  counts: { pending: number; resolved: number };
  painters: InspectionPainter[];
  onChange: (patch: Partial<ItemFilters>) => void;
  onClear: () => void;
}) {
  const { ti } = useTi();
  const active = activeFilterCount(filters);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" className={cn("relative size-9", active > 0 && "border-primary/60 bg-primary/5 text-primary")} aria-label={ti("filters")} title={ti("filters")}>
          <SlidersHorizontal className="size-4" />
          {active > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{active}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3 p-3">
        <FilterBlock label={ti("f_status")}>
          <Pills
            value={filters.onlyPending ? "p" : "t"}
            onChange={(v) => onChange({ onlyPending: v === "p" })}
            options={[
              { value: "p", label: `${ti("show_pending")} (${counts.pending})` },
              { value: "t", label: `${ti("show_all")} (${counts.pending + counts.resolved})` },
            ]}
          />
        </FilterBlock>
        <FilterBlock label={ti("f_kind")}>
          <Pills
            value={filters.kind}
            onChange={(kind) => onChange({ kind, painterId: kind === "pintura" || kind === "todos" ? filters.painterId : "todos" })}
            options={[
              { value: "todos", label: ti("all_short") },
              { value: "pintura", label: ti("kind_pintura") },
              { value: "carpinteria", label: ti("kind_carpinteria") },
              { value: "otro", label: ti("kind_otro") },
              { value: "sin", label: ti("kind_sin") },
            ]}
          />
        </FilterBlock>
        {painters.length > 0 && (filters.kind === "todos" || filters.kind === "pintura") && (
          <FilterBlock label={ti("f_painter")}>
            <Select value={filters.painterId} onValueChange={(painterId) => onChange({ painterId })}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{ti("all_painters")}</SelectItem>
                {painters.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBlock>
        )}
        <FilterBlock label={ti("f_responsible")}>
          <Pills
            value={filters.responsible}
            onChange={(responsible) => onChange({ responsible })}
            options={[
              { value: "todos", label: ti("all_short") },
              { value: "ebony", label: ti("resp_ebony") },
              { value: "tercero", label: ti("resp_tercero") },
            ]}
          />
        </FilterBlock>
        {active > 0 && (
          <button type="button" onClick={onClear} className="self-start text-xs font-medium text-primary hover:underline">
            {ti("clear_filters")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </div>
  );
}

/** Cuántos filtros cambian lo que se ve (Pendientes es lo normal: no cuenta). */
function activeFilterCount(f: ItemFilters): number {
  return (f.onlyPending ? 0 : 1) + (f.kind !== "todos" ? 1 : 0) + (f.painterId !== "todos" ? 1 : 0) + (f.responsible !== "todos" ? 1 : 0);
}

/** Los filtros puestos, como chips que se quitan con la X. */
function ActiveFilters({ filters, painterName, onChange }: { filters: ItemFilters; painterName: (id: string) => string; onChange: (patch: Partial<ItemFilters>) => void }) {
  const { ti } = useTi();
  const chips: { key: string; label: string; clear: Partial<ItemFilters> }[] = [];
  if (!filters.onlyPending) chips.push({ key: "status", label: ti("status_all"), clear: { onlyPending: true } });
  if (filters.kind !== "todos") chips.push({ key: "kind", label: filters.kind === "sin" ? ti("kind_sin") : ti(KIND_KEY[filters.kind]), clear: { kind: "todos" } });
  if (filters.painterId !== "todos") chips.push({ key: "painter", label: painterName(filters.painterId), clear: { painterId: "todos" } });
  if (filters.responsible !== "todos") chips.push({ key: "resp", label: ti(filters.responsible === "ebony" ? "resp_ebony" : "resp_tercero"), clear: { responsible: "todos" } });
  if (chips.length === 0) return null;
  return (
    <div className="-mt-1 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.clear)}
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-foreground"
        >
          {c.label}
          <X className="size-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

/** Los detalles en tarjetitas: 2 por fila en el celular, más en pantallas grandes. */
const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/** Un detalle en tarjetita: fotos (carrusel), área, comentario, estado y acciones. */
function ItemCard({
  item,
  visitLabel,
  showArea = true,
  selecting,
  selected,
  onToggle,
  onOpenPhoto,
  onEdit,
  onChanged,
}: {
  item: InspectionItem;
  /** Si no se agrupa por visita: la fecha de su visita. */
  visitLabel?: string;
  /** Agrupado por área, el área ya está en el título del grupo. */
  showArea?: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
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
    <li
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border bg-card",
        selected ? "border-primary ring-2 ring-primary/40" : resolved ? "border-success/30" : "border-border",
      )}
    >
      {/* Seleccionando: toda la tarjeta marca o desmarca. */}
      {selecting && (
        <button type="button" onClick={() => onToggle(item.id)} aria-pressed={selected} className="absolute inset-0 z-10 flex items-start justify-end p-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-md border-2 shadow-sm",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/25",
            )}
          >
            {selected && <Check className="size-4" />}
          </span>
        </button>
      )}
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
        {(showArea || visitLabel) && (
          <span className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-tight font-semibold text-foreground">
            {showArea && (item.area || <span className="font-normal text-muted-foreground">{ti("no_area")}</span>)}
            {visitLabel && <span className="text-[11px] font-normal text-muted-foreground">{visitLabel}</span>}
          </span>
        )}
        <DetailTags item={item} className="my-0.5" />
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
