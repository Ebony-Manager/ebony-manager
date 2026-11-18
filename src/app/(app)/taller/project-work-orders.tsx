"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Cpu, Palette, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ShowToggle } from "@/components/shared/page-header";
import { FormSection } from "@/components/shared/form-section";
import type { TallerPainter, TallerPerson, TallerProject, VeneerType, WorkOrder, WorkOrderKind } from "@/types/taller";
import { WorkOrderCard, useTt } from "./shared";
import { WorkOrderDialog } from "./work-order-dialog";
import { WorkOrderDetail } from "./work-order-detail";
import { SampleRequestDialog } from "./sample-request-dialog";
import { ColorsList } from "./colors-view";

const OPEN = new Set(["por_hacer", "en_proceso"]);

/** Pestaña «Taller» de la ficha del proyecto: sus trabajos (abiertos primero), crear uno, abrirlos y sus colores. */
export function ProjectWorkOrders({
  projectId,
  orders,
  people,
  projects,
  painters,
  veneers,
}: {
  projectId: string;
  orders: WorkOrder[];
  people: TallerPerson[];
  projects: TallerProject[];
  painters: TallerPainter[];
  veneers: VeneerType[];
}) {
  const { tt } = useTt();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<WorkOrder | null>(null);
  const [adding, setAdding] = React.useState<WorkOrderKind | null>(null);
  const [showClosed, setShowClosed] = React.useState(false);
  const peopleById = React.useMemo(() => new Map(people.map((p) => [p.employeeId, p])), [people]);
  const paintersById = React.useMemo(() => new Map(painters.map((p) => [p.contractorId, p])), [painters]);

  const open = orders.filter((o) => OPEN.has(o.status));
  const closed = orders.filter((o) => !OPEN.has(o.status));
  const shown = showClosed ? [...open, ...closed] : open;
  const hasSamples = orders.some((o) => o.kind === "muestra" && o.status !== "cancelado");
  const close = (o: boolean) => {
    if (!o) {
      setAdding(null);
      setEditing(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {closed.length > 0 ? <ShowToggle checked={showClosed} onChange={setShowClosed} label={`${tt("status_listo")} / ${tt("status_cancelado")} (${closed.length})`} /> : <span />}
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/taller">{tt("open_taller")}</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="size-3.5" />
                {tt("new")}
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAdding("cnc")}>
                <Cpu className="size-4" />
                {tt("new_cnc")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAdding("muestra")}>
                <Palette className="size-4" />
                {tt("new_muestra")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              painter={o.assigneeContractorId ? paintersById.get(o.assigneeContractorId) : undefined}
              tt={tt}
              showProject={false}
              onOpen={() => setOpenId(o.id)}
            />
          ))}
        </div>
      )}

      {hasSamples && (
        <FormSection icon={Palette} title={tt("project_colors")}>
          <ColorsList orders={orders} painters={painters} veneers={veneers} showProject={false} onOpen={setOpenId} />
        </FormSection>
      )}

      <WorkOrderDetail
        order={orders.find((o) => o.id === openId) ?? null}
        people={people}
        painters={painters}
        veneers={veneers}
        onClose={() => setOpenId(null)}
        onEdit={(o) => {
          setOpenId(null);
          setEditing(o);
        }}
      />
      <WorkOrderDialog
        open={adding === "cnc" || editing?.kind === "cnc"}
        onOpenChange={close}
        order={editing?.kind === "cnc" ? editing : null}
        people={people}
        projects={projects}
        defaultProjectId={projectId}
        onSaved={(id) => setOpenId(id)}
      />
      <SampleRequestDialog
        open={adding === "muestra" || editing?.kind === "muestra"}
        onOpenChange={close}
        order={editing?.kind === "muestra" ? editing : null}
        painters={painters}
        veneers={veneers}
        projects={projects}
        defaultProjectId={projectId}
        onSaved={(id) => setOpenId(id)}
      />
    </div>
  );
}
