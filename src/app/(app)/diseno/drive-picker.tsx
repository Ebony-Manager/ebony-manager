"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ChevronRight, FileText, Folder, Image as ImageIcon } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/page-header";
import { LoadingBlock } from "@/components/shared/loading-block";
import { ensureProjectFolderAction, listDriveFolderAction } from "@/app/(app)/drive-actions";
import type { DriveItem } from "@/lib/google/drive";
import { formatDateCompact } from "@/lib/planilla/format";
import { useTd } from "./shared";

/**
 * Escoger un archivo que ya está en el Drive del proyecto (la presentación final, el despiece…) en vez de subirlo
 * otra vez: se navega la carpeta del proyecto y sus subcarpetas, y se toca el archivo.
 */
export function DrivePicker({ projectId, open, onPick, onClose }: { projectId: string; open: boolean; onPick: (file: DriveItem) => void; onClose: () => void }) {
  const { lang, td } = useTd();
  const [path, setPath] = React.useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = React.useState<DriveItem[] | null>(null);
  const current = path.at(-1);

  /* eslint-disable react-hooks/set-state-in-effect -- al abrir: la carpeta del proyecto. */
  React.useEffect(() => {
    if (!open) return;
    setPath([]);
    setItems(null);
    void ensureProjectFolderAction(projectId).then((r) => {
      if (!r.ok) return void toast.error(r.error);
      setPath([{ id: r.data.folderId, name: td("picker_root") }]);
    });
  }, [open, projectId, td]);

  React.useEffect(() => {
    if (!current) return;
    setItems(null);
    void listDriveFolderAction(current.id).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        setItems([]);
        return;
      }
      setItems(r.data);
    });
  }, [current]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null;
  return (
    // ui-allow: sin-campos (se navega y se toca un archivo; no hay nada que escribir)
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{td("pick_drive")}</DialogTitle>
          <DialogDescription>{td("picker_desc")}</DialogDescription>
        </DialogHeader>
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {path.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <ChevronRight className="size-3" />}
              <button type="button" className={i === path.length - 1 ? "font-semibold text-foreground" : "hover:text-foreground hover:underline"} onClick={() => setPath(path.slice(0, i + 1))}>
                {p.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        {items === null ? (
          <LoadingBlock rows={5} />
        ) : items.length === 0 ? (
          <EmptyState>{td("picker_empty")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {items.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/40"
                  onClick={() => (f.isFolder ? setPath([...path, { id: f.id, name: f.name }]) : onPick(f))}
                >
                  {f.isFolder ? (
                    <Folder className="size-4 shrink-0 text-primary" />
                  ) : f.mimeType.startsWith("image/") ? (
                    <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  {!f.isFolder && <span className="shrink-0 text-xs text-muted-foreground">{formatDateCompact(lang, f.modifiedTime.slice(0, 10))}</span>}
                  {f.isFolder && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
