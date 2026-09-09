"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import type { Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ProjectFormDialog } from "./project-form-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";

/**
 * Pestaña "Proyectos" del módulo Contratistas — lista simple (nombre,
 * cliente, estado) con crear / editar / borrar. Borrar un proyecto NO
 * borra movimientos (el FK del ledger es `on delete set null`).
 */
export function ProjectsView({ projects }: { projects: Project[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const [deleting, setDeleting] = React.useState<Project | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.clientName ?? "").toLowerCase().includes(q)
    );
  }, [projects, query]);

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
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tt("add_project")}
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {tt("projects_empty")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{tt("no_results")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tt("no_results_desc")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{tt("proj_col_name")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("proj_col_client")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("proj_col_status")}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
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
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title={tt("action_edit")}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      title={tt("proj_delete_title")}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
