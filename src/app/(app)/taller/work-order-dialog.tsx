"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Paperclip, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import { SearchPicker } from "@/app/(app)/contratistas/search-picker";
import { WORK_ORDER_FILE_MAX, type TallerPerson, type TallerProject, type WorkOrder } from "@/types/taller";
import { saveWorkOrderAction } from "./actions";
import { formatSize, uploadWorkOrderFiles, useTt } from "./shared";

const INTERNAL = "__internal";
const LAST_ASSIGNEE_KEY = "taller.lastAssignee";

function readLastAssignee(): string | null {
  try {
    return window.localStorage.getItem(LAST_ASSIGNEE_KEY);
  } catch {
    return null;
  }
}
function saveLastAssignee(id: string | null) {
  try {
    if (id) window.localStorage.setItem(LAST_ASSIGNEE_KEY, id);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/**
 * Crear o editar un trabajo de CNC: qué hay que hacer, de qué proyecto (o interno), quién lo hace (el último
 * responsable elegido queda puesto), para cuándo, notas y, al crear, sus archivos (DXF, plano).
 */
export function WorkOrderDialog({
  open,
  onOpenChange,
  order,
  people,
  projects,
  defaultProjectId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = crear. */
  order: WorkOrder | null;
  people: TallerPerson[];
  projects: TallerProject[];
  /** Al crear desde la ficha de un proyecto. */
  defaultProjectId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const { tt } = useTt();
  const [title, setTitle] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { error, validate, clear, reset } = useFormErrors<"title">();

  const snapshot = () => JSON.stringify([title, projectId, assigneeId, dueDate, notes, files.map((f) => f.name)]);
  const { isDirty, markSeeded } = useFormBaseline(snapshot);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir. */
  React.useEffect(() => {
    if (!open) return;
    reset();
    setTitle(order?.title ?? "");
    setProjectId(order ? order.projectId : (defaultProjectId ?? null));
    setAssigneeId(order ? order.assigneeId : readLastAssignee());
    setDueDate(order?.dueDate ?? "");
    setNotes(order?.notes ?? "");
    setFiles([]);
    markSeeded();
  }, [open, order, defaultProjectId, reset, markSeeded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, () => onOpenChange(false));

  const person = people.find((p) => p.employeeId === assigneeId);
  const project = projects.find((p) => p.id === projectId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["title", !title.trim(), tt("err_title")]])) return;
    setSaving(true);
    const res = await saveWorkOrderAction(order?.id ?? null, { title, projectId, assigneeId, dueDate: dueDate || null, notes }, order?.projectId);
    if (!res.ok) {
      setSaving(false);
      return void toast.error(res.error);
    }
    saveLastAssignee(assigneeId);
    if (files.length > 0) {
      const up = await uploadWorkOrderFiles(res.data, projectId, files);
      for (const f of up.failed) toast.error(tt("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    }
    setSaving(false);
    toast.success(order ? tt("saved") : tt("created"));
    onOpenChange(false);
    onSaved?.(res.data);
  }

  const projectGroups = [
    { options: [{ id: INTERNAL, label: tt("internal") }] },
    { options: projects.filter((p) => p.active || p.id === projectId).map((p) => ({ id: p.id, label: p.name })) },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,36rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? order.title : tt("new")}</DialogTitle>
          <DialogDescription>{tt("kind_cnc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={tt("f_title")} required error={error("title")}>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clear("title");
              }}
              placeholder={tt("f_title_ph")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tt("f_project")} icon={ICON.project}>
              <SearchPicker
                triggerLabel={projectId ? (project?.name ?? "—") : tt("internal")}
                searchPlaceholder={tt("f_project")}
                emptyText={tt("no_results")}
                groups={projectGroups}
                onSelect={(id) => setProjectId(id && id !== INTERNAL ? id : null)}
              />
            </Field>
            <Field label={tt("f_assignee")} icon={ICON.owner} hint={person && !person.userId ? tt("no_access_hint") : undefined}>
              <SearchPicker
                triggerLabel={person?.name ?? tt("no_assignee")}
                searchPlaceholder={tt("f_assignee")}
                emptyText={tt("no_results")}
                noneLabel={tt("no_assignee")}
                groups={[{ options: people.map((p) => ({ id: p.employeeId, label: p.position ? `${p.name} · ${p.position}` : p.name })) }]}
                onSelect={setAssigneeId}
              />
            </Field>
            <Field label={tt("f_due")} icon={ICON.date}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <Field label={tt("f_notes")}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>

          {!order && (
            <Field label={tt("f_files")} hint={tt("f_files_hint")}>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setFiles((cur) => [...cur, ...picked]);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="size-3.5" />
                  {tt("pick_files")}
                </Button>
                {files.length > 0 && (
                  <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className={`shrink-0 text-xs ${f.size > WORK_ORDER_FILE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                          {f.size > WORK_ORDER_FILE_MAX ? tt("too_big") : formatSize(f.size)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground"
                          title={tt("remove_file")}
                          onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {tt("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (files.length ? tt("uploading", { n: files.length }) : tt("saving")) : order ? tt("save") : tt("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
