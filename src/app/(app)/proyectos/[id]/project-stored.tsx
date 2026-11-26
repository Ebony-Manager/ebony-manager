"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MapPin, TriangleAlert } from "lucide-react";

import type { IncomingItem, StoredItem } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page-header";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { STATUS } from "@/lib/ui/status";
import { formatDateCompact } from "@/lib/planilla/format";
import { ItemThumb, qtyWithUnit, useTa } from "../../almacen/shared";
import { RequestNotes } from "../../almacen/compras/edit-request-dialog";

/**
 * Proyecto → Guardado: lo que está en el almacén para este proyecto (lo especial que se compró y lo que trajo el
 * cliente), lo que se pidió y todavía no llega, y lo ya entregado. Se registra y entrega en Almacén → Apartados.
 */
export function ProjectStored({ projectId, items, incoming }: { projectId: string; items: StoredItem[]; incoming: IncomingItem[] }) {
  const { ta, lang } = useTa();
  const inStore = items.filter((i) => i.status === "en_almacen");
  const delivered = items.filter((i) => i.status === "entregado");
  const href = `/almacen/guardado?proyecto=${projectId}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{ta("st_subtitle")}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={href}>
            {ta("st_in_project_more")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      {items.length === 0 && incoming.length === 0 ? (
        <EmptyState>{ta("st_empty")}</EmptyState>
      ) : (
        <>
          {inStore.length > 0 && (
            <section className="flex flex-col gap-2">
              <ListGroupHeader title={ta("st_f_en_almacen")} count={inStore.length} icon={STATUS.stored_en_almacen.icon} />
              <ul className="flex flex-col gap-2">
                {inStore.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
                    <ItemThumb path={r.photoPath} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-foreground">{r.description}</span>
                        <span className="text-sm text-muted-foreground">· {qtyWithUnit(r.qty, r.unit, lang)}</span>
                        {r.origin === "cliente" ? (
                          <StatusBadge status="stored_cliente">{ta("st_badge_cliente")}</StatusBadge>
                        ) : (
                          <StatusBadge status="stored_ebony">{ta("st_badge_ebony")}</StatusBadge>
                        )}
                      </span>
                      {r.projectItemName && <span className="block truncate text-xs text-muted-foreground">{r.projectItemName}</span>}
                      {r.location ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{r.location}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-[var(--status-warn)]">
                          <TriangleAlert className="size-3 shrink-0" />
                          {ta("st_no_location")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {incoming.length > 0 && (
            <section className="flex flex-col gap-2">
              <ListGroupHeader title={ta("st_f_por_llegar")} count={incoming.length} icon={STATUS.stored_por_llegar.icon} />
              <ul className="flex flex-col gap-2">
                {incoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3.5 py-2.5">
                    <ItemThumb path={r.photoPath} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">
                        {r.description} <span className="text-muted-foreground">· {qtyWithUnit(r.qty, r.unit, lang)}</span>
                      </span>
                      {r.requestedBy && <span className="block text-xs text-muted-foreground">{`${ta("st_requested_by")}: ${r.requestedBy}`}</span>}
                      <RequestNotes text={r.notes} />
                    </span>
                    <StatusBadge status={`purchase_${r.status}`}>{ta(`st_incoming_${r.status}`)}</StatusBadge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {delivered.length > 0 && (
            <section className="flex flex-col gap-2">
              <ListGroupHeader title={ta("st_f_entregado")} count={delivered.length} icon={STATUS.stored_entregado.icon} />
              <ul className="flex flex-col gap-1">
                {delivered.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 px-1 text-sm">
                    <span className="text-foreground">{r.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {ta("st_delivered_to")} {r.deliveredToName}
                      {r.deliveredOn ? ` · ${formatDateCompact(lang, r.deliveredOn)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
