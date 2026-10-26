"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, ClipboardCheck, Plus } from "lucide-react";

import type { InspectionOverview, InspectionProject, InspectionProjectCard, RecentInspection } from "@/types/inspections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmptyState, PAGE_CLASS, PageHeader, SectionHeader, ShowToggle } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { inspectionsPath, newInspectionPath } from "./paths";
import { useTi } from "./shared";

/**
 * Inicio de Inspecciones: lo que importa es lo abierto, no la lista de
 * proyectos. Arriba "Nueva inspección" (eliges la obra y a tomar fotos);
 * luego las obras con pendientes y las últimas visitas. Los proyectos sin
 * inspecciones solo aparecen al elegir dónde inspeccionar.
 */
export function InspectionsHome({ projects, overview }: { projects: InspectionProject[]; overview: InspectionOverview }) {
  const { ti } = useTi();
  const [picking, setPicking] = React.useState(false);
  const [showClear, setShowClear] = React.useState(false);
  const byId = React.useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const withPending = overview.projects.filter((c) => c.pending > 0);
  const clear = overview.projects.filter((c) => c.pending === 0);
  const cards = showClear ? [...withPending, ...clear] : withPending;

  const newButton = (className?: string) => (
    <Button onClick={() => setPicking(true)} className={className}>
      <Plus className="size-4" />
      {ti("new_inspection")}
    </Button>
  );

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={ti("title")} subtitle={ti("subtitle")} action={newButton("hidden sm:inline-flex")} />

      {/* En el celular, el botón grande: es a lo que se viene. */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-sm active:opacity-90 sm:hidden"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Camera className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{ti("new_inspection")}</span>
          <span className="block text-xs opacity-85">{ti("new_inspection_hint")}</span>
        </span>
      </button>

      {overview.projects.length === 0 ? (
        <EmptyState className="py-14">
          <ClipboardCheck className="size-6" />
          <p>{ti("no_inspections")}</p>
          {newButton()}
        </EmptyState>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader
              title={ti("section_pending")}
              action={clear.length > 0 ? <ShowToggle checked={showClear} onChange={setShowClear} label={ti("show_clear", { n: clear.length })} /> : undefined}
            />
            {cards.length === 0 ? (
              <EmptyState className="py-6">{ti("nothing_pending")}</EmptyState>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {cards.map((c) => (
                  <ProjectCard key={c.projectId} card={c} project={byId.get(c.projectId)} />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title={ti("section_recent")} />
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {overview.recent.map((v) => (
                <RecentRow key={v.id} visit={v} project={byId.get(v.projectId)} />
              ))}
            </ul>
          </section>
        </>
      )}

      <ProjectPicker open={picking} onClose={() => setPicking(false)} projects={projects} overview={overview} />
    </div>
  );
}

function Thumb({ url, size }: { url: string | null; size: "md" | "sm" }) {
  const cls = size === "md" ? "size-14" : "size-11";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada del bucket privado
    <img src={url} alt="" loading="lazy" className={`${cls} shrink-0 rounded-md border border-border object-cover`} />
  ) : (
    <span className={`${cls} flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground`}>
      <ClipboardCheck className="size-5" />
    </span>
  );
}

function ProjectCard({ card, project }: { card: InspectionProjectCard; project: InspectionProject | undefined }) {
  const { ti, lang } = useTi();
  return (
    <Link
      href={inspectionsPath(card.projectId)}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 active:bg-muted/50"
    >
      <Thumb url={card.thumbUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words text-foreground">{project?.name ?? "—"}</p>
        {project && (project.clientName || project.location) && (
          <p className="truncate text-xs text-muted-foreground">{[project.clientName, project.location].filter(Boolean).join(" · ")}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {card.pending > 0 ? (
            <Badge variant="warning">{card.pending === 1 ? ti("pending_1") : ti("pending_n", { n: card.pending })}</Badge>
          ) : (
            <Badge variant="success">{ti("all_resolved")}</Badge>
          )}
          <span>
            {ti("last_visit", { date: formatDateCompact(lang, card.lastVisit) })} · {card.visits === 1 ? ti("visits_1") : ti("visits_n", { n: card.visits })}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function RecentRow({ visit, project }: { visit: RecentInspection; project: InspectionProject | undefined }) {
  const { ti, lang } = useTi();
  return (
    <li>
      <Link href={inspectionsPath(visit.projectId)} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/30 active:bg-muted/50">
        <Thumb url={visit.thumbUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">
            <span className="font-semibold">{formatDateCompact(lang, visit.visitedOn)}</span> · {project?.name ?? "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[visit.createdByName ? ti("by", { name: visit.createdByName }) : null, visit.notes].filter(Boolean).join(" · ") ||
              (visit.items === 0 ? ti("no_items") : visit.items === 1 ? ti("items_1") : ti("items_n", { n: visit.items }))}
          </p>
        </div>
        {visit.pending > 0 ? (
          <Badge variant="warning">{visit.pending === 1 ? ti("pending_1") : ti("pending_n", { n: visit.pending })}</Badge>
        ) : visit.items > 0 ? (
          <Badge variant="success">{ti("all_resolved")}</Badge>
        ) : null}
      </Link>
    </li>
  );
}

/** "¿En qué obra estás?": las inspeccionadas hace poco primero, luego los activos y los terminados. */
function ProjectPicker({
  open,
  onClose,
  projects,
  overview,
}: {
  open: boolean;
  onClose: () => void;
  projects: InspectionProject[];
  overview: InspectionOverview;
}) {
  const { ti } = useTi();
  const router = useRouter();

  const recentIds = [...overview.projects]
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
    .slice(0, 5)
    .map((c) => c.projectId);
  const recent = recentIds.map((id) => projects.find((p) => p.id === id)).filter((p): p is InspectionProject => !!p);
  const rest = projects.filter((p) => !recentIds.includes(p.id));
  const groups = [
    { key: "recent", label: ti("pick_recent"), items: recent },
    { key: "active", label: ti("pick_active"), items: rest.filter((p) => p.active) },
    { key: "completed", label: ti("pick_completed"), items: rest.filter((p) => !p.active) },
  ].filter((g) => g.items.length > 0);

  const pick = (id: string) => {
    onClose();
    router.push(newInspectionPath(id));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-3 p-0 sm:p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{ti("pick_title")}</DialogTitle>
        </DialogHeader>
        <Command className="border-t border-border">
          <CommandInput placeholder={ti("search_ph")} />
          <CommandList className="max-h-[60dvh]">
            <CommandEmpty>{ti("no_results")}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.key} heading={g.label}>
                {g.items.map((p) => (
                  <CommandItem key={p.id} value={`${p.name} ${p.clientName ?? ""} ${p.location ?? ""} ${p.id}`} onSelect={() => pick(p.id)} className="py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      {(p.clientName || p.location) && (
                        <span className="block truncate text-xs text-muted-foreground">{[p.clientName, p.location].filter(Boolean).join(" · ")}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
