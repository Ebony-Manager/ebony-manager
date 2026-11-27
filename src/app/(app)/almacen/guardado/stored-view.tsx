"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { HandHelping, MapPin, Pencil, Plus, TriangleAlert, Undo2 } from "lucide-react";

import type { IncomingItem, PurchaseRequest, StoredItem, StoredPerson, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListToolbar } from "@/components/shared/search-input";
import { PAGE_CLASS, ShowToggle } from "@/components/shared/page-header";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatCents } from "@/lib/planilla/payroll-period";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import { ICON } from "@/lib/ui/concepts";
import { EmptyBox, ItemThumb, PageHeader, SearchBox, qtyWithUnit, useTa } from "../shared";
import { StoredDialog } from "./stored-dialog";
import { DeliverDialog } from "./deliver-dialog";
import { undoStoredDeliveryAction } from "./actions";
import { EditRequestDialog, RequestNotes } from "../compras/edit-request-dialog";

type Project = { id: string; name: string; active: boolean };
type Group = { id: string; name: string; inStore: StoredItem[]; coming: IncomingItem[]; delivered: StoredItem[] };

/**
 * Almacén → Apartados: una sola lista agrupada por proyecto. En cada proyecto, juntos, lo que está
 * en el almacén (con dónde está y «Entregar») y lo especial que se pidió y viene en camino; lo entregado queda
 * escondido detrás de «Mostrar entregados» (es historial). Registran y entregan Almacén, Diseño y Proyectos.
 */
export function StoredView({
  items,
  incoming,
  myRequests,
  people,
  projects,
  suppliers,
  canCosts,
  initialProjectId,
}: {
  items: StoredItem[];
  incoming: IncomingItem[];
  /** Las solicitudes que esta persona puede ver en Compras (las suyas, o todas con Compras): con su link y para editarlas. */
  myRequests: PurchaseRequest[];
  people: StoredPerson[];
  projects: Project[];
  suppliers: Supplier[];
  canCosts: boolean;
  initialProjectId: string | null;
}) {
  const { ta, lang } = useTa();
  const [query, setQuery] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>(initialProjectId ?? "all");
  const [showDelivered, setShowDelivered] = React.useState(false);
  const [editing, setEditing] = React.useState<StoredItem | "new" | null>(null);
  const [delivering, setDelivering] = React.useState<StoredItem | null>(null);
  const [editingRequest, setEditingRequest] = React.useState<PurchaseRequest | null>(null);
  const requestById = React.useMemo(() => new Map(myRequests.map((r) => [r.id, r])), [myRequests]);

  const inProject = (projectId: string) => projectFilter === "all" || projectId === projectFilter;
  const q = normalizeSearchText(query);
  const stored = items.filter((i) => inProject(i.projectId) && (!q || matchesSearch(`${i.description} ${i.projectName} ${i.location ?? ""} ${i.projectItemName ?? ""}`, q)));
  const coming = incoming.filter((i) => inProject(i.projectId) && (!q || matchesSearch(`${i.description} ${i.projectName}`, q)));
  const deliveredCount = stored.filter((i) => i.status === "entregado").length;

  // Proyectos con algo (para el filtro), más el que viene en el enlace.
  const projectsWithStuff = React.useMemo(() => {
    const ids = new Set([...items.map((i) => i.projectId), ...incoming.map((i) => i.projectId)]);
    if (initialProjectId) ids.add(initialProjectId);
    return projects.filter((p) => ids.has(p.id));
  }, [items, incoming, projects, initialProjectId]);

  // Un grupo por proyecto con lo que hay que ver: guardado y por llegar (y lo entregado si se pidió).
  const groups: Group[] = (() => {
    const map = new Map<string, Group>();
    const get = (id: string, name: string) => {
      const g = map.get(id) ?? { id, name: projects.find((p) => p.id === id)?.name ?? name, inStore: [], coming: [], delivered: [] };
      map.set(id, g);
      return g;
    };
    for (const s of stored) {
      if (s.status === "en_almacen") get(s.projectId, s.projectName).inStore.push(s);
      else if (showDelivered) get(s.projectId, s.projectName).delivered.push(s);
    }
    for (const c of coming) get(c.projectId, c.projectName).coming.push(c);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  })();

  async function undo(item: StoredItem) {
    const res = await undoStoredDeliveryAction(item.id);
    if (!res.ok) toast.error(res.error);
  }

  const storedRow = (r: StoredItem) => (
    <li key={r.id}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(r)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(r)}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left hover:bg-muted/40 ${r.status === "entregado" ? "opacity-70" : ""}`}
      >
        <ItemThumb path={r.photoPath} size={48} />
        <span className="min-w-0 flex-1">
          {/* Nombre y cantidad en su línea; las etiquetas siempre debajo (igual si el nombre es corto o largo). */}
          <span className="block font-medium text-foreground">
              {r.description}
              <span className="text-sm font-normal text-muted-foreground">{`\u00a0·\u00a0${qtyWithUnit(r.qty, r.unit, lang).replace(/ /g, "\u00a0")}`}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {r.status === "entregado" ? (
              <StatusBadge status="stored_entregado">{ta("st_f_entregado")}</StatusBadge>
            ) : (
              <StatusBadge status="stored_en_almacen">{ta("st_f_en_almacen")}</StatusBadge>
            )}
            {r.origin === "cliente" && <StatusBadge status="stored_cliente">{ta("st_badge_cliente")}</StatusBadge>}
          </span>
          {r.projectItemName && <span className="block truncate text-xs text-muted-foreground">{r.projectItemName}</span>}
          {r.status === "entregado" ? (
            <span className="block text-xs text-muted-foreground">
              {ta("st_delivered_to")} {r.deliveredToName}
              {r.deliveredOn ? ` · ${formatDateCompact(lang, r.deliveredOn)}` : ""}
            </span>
          ) : r.location ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{r.location}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-warning">
              <TriangleAlert className="size-3 shrink-0" />
              {ta("st_no_location")}
            </span>
          )}
          <span className="block text-xs text-muted-foreground">
            {[
              formatDateCompact(lang, r.receivedOn),
              r.receivedByName && `${ta("st_received_by")}: ${r.receivedByName}`,
              r.supplierName,
              r.totalCents != null ? formatCents(r.totalCents) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {r.status === "en_almacen" ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            aria-label={ta("st_deliver")}
            title={ta("st_deliver")}
            onClick={(e) => {
              e.stopPropagation();
              setDelivering(r);
            }}
          >
            <HandHelping className="size-3.5" />
            <span className="hidden sm:inline">{ta("st_deliver")}</span>
          </Button>
        ) : (
          <span onClick={(e) => e.stopPropagation()} className="shrink-0">
            <ConfirmButton icon={Undo2} iconOnly label={ta("st_undo_delivery")} confirmLabel={ta("st_undo_confirm")} onConfirm={() => void undo(r)} />
          </span>
        )}
      </div>
    </li>
  );

  const comingRow = (r: IncomingItem) => {
    // Se edita mientras está por comprar, si es suya o tiene Compras (las que llegan en myRequests).
    const req = requestById.get(r.id);
    const editable = req?.status === "pendiente" || req?.status === "pedido";
    return (
    <li key={r.id}>
      <div
        role={editable ? "button" : undefined}
        tabIndex={editable ? 0 : undefined}
        onClick={editable ? () => setEditingRequest(req) : undefined}
        onKeyDown={editable ? (e) => e.key === "Enter" && setEditingRequest(req) : undefined}
        title={editable ? ta("edit_request_hint") : undefined}
        className={`flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3.5 py-2.5 ${editable ? "cursor-pointer hover:bg-muted/40" : ""}`}
      >
      <ItemThumb path={r.photoPath} size={48} />
      <span className="min-w-0 flex-1">
        {/* Nombre y cantidad en su línea; las etiquetas siempre debajo (igual si el nombre es corto o largo). */}
        <span className="block font-medium text-foreground">
            {r.description}
            <span className="text-sm font-normal text-muted-foreground">{`\u00a0·\u00a0${qtyWithUnit(r.qty, r.unit, lang).replace(/ /g, "\u00a0")}`}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={`purchase_${r.status}`}>{ta(`st_incoming_${r.status}`)}</StatusBadge>
        </span>
        <span className="block text-xs text-muted-foreground">
          {[r.requestedBy && `${ta("st_requested_by")}: ${r.requestedBy}`, formatDateCompact(lang, r.createdAt.slice(0, 10))].filter(Boolean).join(" · ")}
        </span>
        <RequestNotes text={r.notes} />
      </span>
      {editable && <Pencil className="size-3.5 shrink-0 text-muted-foreground" />}
      </div>
    </li>
    );
  };

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={ta("st_title")}
        subtitle={ta("st_subtitle")}
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" />
            {ta("st_register")}
          </Button>
        }
      />

      <ListToolbar>
        <SearchBox value={query} onChange={setQuery} placeholder={ta("st_search_ph")} />
        {projectsWithStuff.length > 1 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            {/* En el teléfono va en su propia fila: así la búsqueda tiene todo el ancho y no se corta. */}
            <SelectTrigger className="h-9 w-full min-w-48 sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ta("st_all_projects")}</SelectItem>
              {projectsWithStuff.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ListToolbar>

      {items.length === 0 && incoming.length === 0 ? (
        <EmptyBox>{ta("st_empty")}</EmptyBox>
      ) : groups.length === 0 ? (
        <EmptyBox>{ta("st_empty_filter")}</EmptyBox>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.id} className="flex flex-col gap-2">
              <ListGroupHeader title={g.name} count={g.inStore.length + g.coming.length} icon={ICON.project} />
              <ul className="flex flex-col gap-2">
                {g.inStore.map(storedRow)}
                {g.coming.map(comingRow)}
                {g.delivered.map(storedRow)}
              </ul>
            </section>
          ))}
        </div>
      )}

      {deliveredCount > 0 && (
        <ShowToggle className="self-end" checked={showDelivered} onChange={setShowDelivered} label={`${ta("st_show_delivered")} (${deliveredCount})`} />
      )}

      <StoredDialog
        item={editing}
        defaultProjectId={projectFilter !== "all" ? projectFilter : null}
        projects={projects}
        suppliers={suppliers}
        canCosts={canCosts}
        onClose={() => setEditing(null)}
        onDeliver={(it) => {
          setEditing(null);
          setDelivering(it);
        }}
      />
      <DeliverDialog item={delivering} people={people} onClose={() => setDelivering(null)} />
      <EditRequestDialog request={editingRequest} projects={projects} suppliers={suppliers} onClose={() => setEditingRequest(null)} />
    </div>
  );
}
