"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, FolderOpen, Image as ImageIcon, Plus } from "lucide-react";

import type { Project } from "@/types/contractors";
import type { ProjectDelivery } from "@/types/deliveries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateProjectAction } from "../../contratistas/actions";
import { assignDeliveryAction, getActaUrlAction } from "../delivery-actions";

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/**
 * Entregas: las actas de entrega del proyecto (formulario de JotForm que firma
 * el cliente). "Nueva acta" abre el formulario con el proyecto puesto; al
 * enviarlo, el acta llega sola aquí con su PDF y fotos en Drive.
 */
export function ProjectDeliveries({
  project,
  deliveries,
  unassigned,
}: {
  project: Project;
  deliveries: ProjectDelivery[];
  unassigned: ProjectDelivery[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const router = useRouter();
  const [opening, setOpening] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const openForm = async () => {
    // La ventana se abre ya (si se abre después de esperar, el navegador la bloquea).
    const win = window.open("about:blank", "_blank");
    setOpening(true);
    const res = await getActaUrlAction(project.id);
    setOpening(false);
    if (!res.ok) {
      win?.close();
      toast.error(res.error);
      return;
    }
    if (!res.data.prefilled) toast(tt("acta_not_prefilled"));
    if (win) win.location.href = res.data.url;
    else window.location.href = res.data.url;
  };

  const markCompleted = async () => {
    setCompleting(true);
    try {
      await updateProjectAction(project.id, { status: "COMPLETED" });
      toast.success(tt("acta_marked"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCompleting(false);
    }
  };

  const assign = async (id: string) => {
    const res = await assignDeliveryAction(id, project.id);
    if (!res.ok) return toast.error(res.error);
    toast.success(tt("acta_assigned"));
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-xs text-muted-foreground">{tt("acta_hint")}</p>
        <Button size="sm" onClick={openForm} disabled={opening}>
          <Plus className="size-3.5" />
          {opening ? tt("acta_opening") : tt("acta_new")}
        </Button>
      </div>

      {project.status === "ACTIVE" && deliveries.length > 0 && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{tt("acta_suggest_title")}</p>
              <p className="text-xs text-muted-foreground">{tt("acta_suggest_body")}</p>
            </div>
            <Button size="sm" variant="outline" className="self-start sm:self-auto" onClick={markCompleted} disabled={completing}>
              <CheckCircle2 className="size-3.5" />
              {tt("acta_mark_completed")}
            </Button>
          </div>
        </Card>
      )}

      {deliveries.length === 0 ? (
        <EmptyState>{tt("acta_empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {deliveries.map((d) => (
            <li key={d.id}>
              <DeliveryCard delivery={d} />
            </li>
          ))}
        </ul>
      )}

      {unassigned.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {tt("acta_unassigned_title")} ({unassigned.length})
            </h2>
            <p className="text-xs text-muted-foreground">{tt("acta_unassigned_body")}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {unassigned.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{d.projectName}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatDateCompact(lang, d.deliveredOn)}
                    {d.clientName ? ` · ${d.clientName}` : ""}
                  </span>
                </span>
                <Button size="sm" variant="outline" className="self-start sm:self-auto" onClick={() => assign(d.id)}>
                  {tt("acta_assign_here")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function DeliveryCard({ delivery: d }: { delivery: ProjectDelivery }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{formatDateCompact(lang, d.deliveredOn)}</p>
          <p className="text-xs text-muted-foreground">
            {tt("acta_received_by")}: {d.clientName || tt("none")}
            {d.clientIdDoc ? ` · ${tt("acta_id_doc")} ${d.clientIdDoc}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.pdfFileId && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/drive/file/${d.pdfFileId}`} target="_blank" rel="noreferrer">
                <FileText className="size-3.5" />
                {tt("acta_pdf")}
              </a>
            </Button>
          )}
          {d.driveFolderId && (
            <Button size="sm" variant="ghost" asChild>
              <a href={folderUrl(d.driveFolderId)} target="_blank" rel="noreferrer">
                <FolderOpen className="size-3.5" />
                {tt("acta_folder")}
                <ExternalLink className="size-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
      {d.items && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{tt("acta_items")}</p>
          <p className="whitespace-pre-line text-sm text-foreground">{d.items}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {d.photoCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="size-3.5" />
            {tt("acta_photos").replace("{n}", String(d.photoCount))}
          </span>
        )}
        {!d.pdfFileId && !d.filesError && <span>{tt("acta_pdf_missing")}</span>}
        {d.filesError && (
          <span className="inline-flex items-center gap-1 text-warning">
            <AlertTriangle className="size-3.5" />
            {tt("acta_files_error").replace("{e}", d.filesError)}
          </span>
        )}
      </div>
    </Card>
  );
}
