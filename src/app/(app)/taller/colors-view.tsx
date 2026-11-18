"use client";

import * as React from "react";
import { Palette, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EmptyState, ShowToggle } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import type { TallerPainter, VeneerType, WorkOrder } from "@/types/taller";
import { PainterAvatar, WorkStatusBadge, driveThumb, useTt } from "./shared";

/** Día (AAAA-MM-DD) en Panamá de una fecha y hora guardada. */
const panamaDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Panama" });

/** Una fila del control de colores: una muestra con su solicitud. */
interface ColorRow {
  key: string;
  order: WorkOrder;
  name: string;
  kindLabel: string;
  code: string | null;
  resultFileId: string | null;
}

export function colorRows(orders: WorkOrder[], veneers: VeneerType[], tt: ReturnType<typeof useTt>["tt"]): ColorRow[] {
  const veneerName = (id: string | null) => veneers.find((v) => v.id === id)?.name;
  return orders
    .filter((o) => o.kind === "muestra" && o.status !== "cancelado")
    .flatMap((o) =>
      o.samples.map((s) => ({
        key: s.id,
        order: o,
        name: s.name,
        kindLabel: [tt(`sk_${s.kind}`), s.kind === "chapilla" ? veneerName(s.veneerTypeId) : null].filter(Boolean).join(" · "),
        code: s.officialCode,
        resultFileId: o.files.find((f) => f.sampleId === s.id && f.role === "resultado")?.driveFileId ?? null,
      })),
    )
    .sort((a, b) => (b.order.doneAt ?? b.order.createdAt).localeCompare(a.order.doneAt ?? a.order.createdAt));
}

/**
 * El control de colores: todas las muestras pedidas (las más nuevas primero) con su foto terminada, el código oficial,
 * el proyecto y quién la hizo. Se busca por color, código o proyecto. En la ficha del proyecto sale solo lo suyo.
 */
export function ColorsList({
  orders,
  painters,
  veneers,
  showProject = true,
  onOpen,
}: {
  orders: WorkOrder[];
  painters: TallerPainter[];
  veneers: VeneerType[];
  showProject?: boolean;
  onOpen: (orderId: string) => void;
}) {
  const { lang, tt } = useTt();
  const [q, setQ] = React.useState("");
  const [onlyDone, setOnlyDone] = React.useState(false);
  const all = React.useMemo(() => colorRows(orders, veneers, tt), [orders, veneers, tt]);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((r) => {
    if (onlyDone && r.order.status !== "listo") return false;
    if (!needle) return true;
    return [r.name, r.code, r.order.projectName, r.kindLabel].some((v) => v?.toLowerCase().includes(needle));
  });

  if (all.length === 0) return <EmptyState icon={Palette}>{tt("colors_empty")}</EmptyState>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("colors_search_ph")} className="h-9 pl-8" />
        </div>
        <ShowToggle checked={onlyDone} onChange={setOnlyDone} label={tt("only_done")} />
      </div>
      {rows.length === 0 ? (
        <EmptyState>{tt("no_results")}</EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const painter = painters.find((p) => p.contractorId === r.order.assigneeContractorId);
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onOpen(r.order.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  {r.resultFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- la foto pasa por la app (Drive privado)
                    <img src={driveThumb(r.resultFileId)} alt={r.name} loading="lazy" className="size-16 shrink-0 rounded-md border border-border bg-muted object-cover" />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Palette className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.kindLabel}
                      {r.code ? ` · ${r.code}` : ""}
                    </span>
                    {showProject && <span className="truncate text-xs text-muted-foreground">{r.order.projectName ?? tt("internal")}</span>}
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <WorkStatusBadge status={r.order.status} tt={tt} />
                      {painter && (
                        <span className="flex items-center gap-1">
                          <PainterAvatar painter={painter} />
                          {painter.name.split(" ")[0]}
                        </span>
                      )}
                      <span>{formatDateCompact(lang, panamaDay(r.order.doneAt ?? r.order.createdAt))}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

