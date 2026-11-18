"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/shared/profile-card";
import { ICON } from "@/lib/ui/concepts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { DesignerCandidate, ProjectDesigner } from "@/types/designers";
import { addProjectDesignerAction, removeProjectDesignerAction } from "../designer-actions";

/**
 * Las diseñadoras de Ebony en este proyecto (puede haber varias). Quien administra proyectos las asigna y
 * las quita; una diseñadora solo ve la lista. Se asigna a la persona de Personal: puede hacerse antes de
 * darle acceso a la app.
 */
export function ProjectDesigners({
  projectId,
  designers,
  candidates,
  canEdit,
}: {
  projectId: string;
  designers: ProjectDesigner[];
  candidates: DesignerCandidate[];
  canEdit: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const assigned = new Set(designers.map((d) => d.employeeId));
  const options = candidates.filter((c) => !assigned.has(c.id));

  async function add(employeeId: string) {
    setBusy(true);
    const res = await addProjectDesignerAction(projectId, employeeId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("dz_added"));
    setAdding(false);
  }

  async function remove(employeeId: string) {
    setBusy(true);
    const res = await removeProjectDesignerAction(projectId, employeeId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("dz_removed"));
  }

  return (
    <ProfileCard
      icon={ICON.designer}
      title={tt("dz_title")}
      subtitle={canEdit ? tt("dz_hint") : undefined}
      action={
        canEdit && !adding && options.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            {tt("dz_add")}
          </Button>
        ) : undefined
      }
    >

      {designers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tt("dz_none")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {designers.map((d) => (
            <li key={d.employeeId} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm">
              <span className="font-medium text-foreground">{d.name}</span>
              {d.position && <span className="text-xs text-muted-foreground">{d.position}</span>}
              {!d.active && <Badge variant="secondary">{tt("dz_inactive")}</Badge>}
              {canEdit && !d.hasAccess && <Badge variant="outline">{tt("dz_no_access")}</Badge>}
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(d.employeeId)}
                  aria-label={tt("dz_remove")}
                  title={tt("dz_remove")}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && adding && (
        <div className="flex items-center gap-2">
          <Select disabled={busy} onValueChange={(v) => void add(v)}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder={tt("dz_pick")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.position ? ` · ${c.position}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="size-9 shrink-0" onClick={() => setAdding(false)} aria-label={tt("dz_cancel")} title={tt("dz_cancel")}>
            <X className="size-4" />
          </Button>
        </div>
      )}
    </ProfileCard>
  );
}
