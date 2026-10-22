"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";

import type { Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectDetailSheet } from "./project-detail-sheet";
import { DeleteProjectDialog } from "./delete-project-dialog";

/**
 * Personal → Pagos → Contratos (antes "Proyectos" de Contratistas) — lista (nombre, cliente,
 * estado). Click en una fila abre la FICHA DE CONTRATO del proyecto
 * (`ProjectDetailSheet`); desde ahí se edita / borra. Borrar un proyecto
 * NO borra movimientos (el FK del ledger es `on delete set null`).
 * Arriba van los activos; los terminados quedan plegados al final (se
 * abren solos al buscar, para que la búsqueda los encuentre).
 */
export function ProjectsView({
  projects,
  actions,
}: {
  projects: Project[];
  /** Botones extra junto a "Agregar" (ej. Tarifas). */
  actions?: React.ReactNode;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<Project | null>(null);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const [deleting, setDeleting] = React.useState<Project | null>(null);
  const [showCompleted, setShowCompleted] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.clientName ?? "").toLowerCase().includes(q)
    );
  }, [projects, query]);
  const active = filtered.filter((p) => p.status === "ACTIVE");
  const completed = filtered.filter((p) => p.status !== "ACTIVE");
  const completedOpen = showCompleted || query.trim() !== "";

  // Si la lista se recarga (router.refresh tras guardar), refresca la
  // copia que muestra la ficha abierta.
  /* eslint-disable react-hooks/set-state-in-effect -- re-sincroniza con el proyecto ya seleccionado. */
  React.useEffect(() => {
    setViewing((cur) => (cur ? projects.find((p) => p.id === cur.id) ?? null : cur));
  }, [projects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tt("proj_search_ph")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            {tt("add_project")}
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-10 text-center text-sm text-muted-foreground">
          {tt("projects_empty")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{tt("no_results")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tt("no_results_desc")}</p>
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <ProjectTable projects={active} onOpen={setViewing} onDelete={setDeleting} />
          ) : (
            <div className="rounded-xl border border-dashed border-ink-900/8 px-6 py-6 text-center text-sm text-muted-foreground">
              {tt("proj_no_active")}
            </div>
          )}

          {completed.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {completedOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                {tt("proj_completed_section")} ({completed.length})
              </button>
              {completedOpen && <ProjectTable projects={completed} onOpen={setViewing} onDelete={setDeleting} />}
            </div>
          )}
        </>
      )}

      <ProjectDetailSheet
        project={viewing}
        open={viewing !== null}
        onOpenChange={(next) => !next && setViewing(null)}
        onEdit={() => setEditing(viewing)}
        onDelete={() => {
          setDeleting(viewing);
          setViewing(null);
        }}
      />

      <ProjectFormDialog project={null} open={addOpen} onOpenChange={setAddOpen} />
      <ProjectFormDialog
        project={editing}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />
      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          open={deleting !== null}
          onOpenChange={(next) => !next && setDeleting(null)}
        />
      )}
    </div>
  );
}

function ProjectTable({
  projects,
  onOpen,
  onDelete,
}: {
  projects: Project[];
  onOpen: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">{tt("proj_col_name")}</th>
            <th className="px-3 py-2 text-left font-medium">{tt("proj_col_client")}</th>
            <th className="px-3 py-2 text-left font-medium">{tt("proj_col_status")}</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              onClick={() => onOpen(p)}
              className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {p.name}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{p.clientName || "—"}</td>
              <td className="px-3 py-2">
                <Badge variant={p.status === "ACTIVE" ? "secondary" : "outline"}>
                  {p.status === "ACTIVE" ? tt("proj_status_active") : tt("proj_status_completed")}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-destructive"
                  title={tt("proj_delete_title")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
