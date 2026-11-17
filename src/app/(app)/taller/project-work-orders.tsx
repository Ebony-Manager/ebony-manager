"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ShowToggle } from "@/components/shared/page-header";
import type { TallerPerson, TallerProject, WorkOrder } from "@/types/taller";
import { WorkOrderCard, useTt } from "./shared";
import { WorkOrderDialog } from "./work-order-dialog";
import { WorkOrderDetail } from "./work-order-detail";

const OPEN = new Set(["por_hacer", "en_proceso"]);

/** Pestaña «Taller» de la ficha del proyecto: sus trabajos (abiertos primero), crear uno y abrirlos. */
export function ProjectWorkOrders({
  projectId,
  orders,
  people,
  projects,
}: {
  projectId: string;
  orders: WorkOrder[];
  people: TallerPerson[];
  projects: TallerProject[];
}) {
  const { tt } = useTt();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<WorkOrder | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [showClosed, setShowClosed] = React.useState(false);
  const peopleById = React.useMemo(() => new Map(people.map((p) => [p.employeeId, p])), [people]);

  const open = orders.filter((o) => OPEN.has(o.status));
  const closed = orders.filter((o) => !OPEN.has(o.status));
  const shown = showClosed ? [...open, ...closed] : open;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {closed.length > 0 ? <ShowToggle checked={showClosed} onChange={setShowClosed} label={`${tt("status_listo")} / ${tt("status_cancelado")} (${closed.length})`} /> : <span />}
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/taller">{tt("open_taller")}</Link>
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            {tt("new")}
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState>{tt("project_block_empty")}</EmptyState>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((o) => (
            <WorkOrderCard
              key={o.id}
              order={o}
              person={o.assigneeId ? peopleById.get(o.assigneeId) : undefined}
              tt={tt}
              showProject={false}
              onOpen={() => setOpenId(o.id)}
            />
          ))}
        </div>
      )}

      <WorkOrderDetail
        order={orders.find((o) => o.id === openId) ?? null}
        people={people}
        onClose={() => setOpenId(null)}
        onEdit={(o) => {
          setOpenId(null);
          setEditing(o);
        }}
      />
      <WorkOrderDialog
        open={adding || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        order={editing}
        people={people}
        projects={projects}
        defaultProjectId={projectId}
        onSaved={(id) => setOpenId(id)}
      />
    </div>
  );
}
