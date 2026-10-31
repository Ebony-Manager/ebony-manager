"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ChevronRight, Download, ExternalLink, File, FileImage, FileText, FileVideo, Folder, FolderPlus, Loader2, Upload, X } from "lucide-react";

import type { DriveItem } from "@/lib/google/drive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/context/language-context";
import { formatDateCompact } from "@/lib/planilla/format";
import { strings, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createDriveSubfolderAction, listDriveFolderAction, startDriveUploadAction, trashDriveItemAction } from "@/app/(app)/drive-actions";
import { ConfirmButton } from "@/components/shared/confirm-button";

/** Hasta este tamaño se ve dentro de la app (pasa por Vercel); más pesado, en Drive. */
const PREVIEW_MAX = 4 * 1024 * 1024;

const fileUrl = (id: string) => `/api/drive/file/${id}`;
const driveFileUrl = (item: DriveItem) => item.webViewLink ?? `https://drive.google.com/file/d/${item.id}/view`;
const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

function useTd() {
  const { lang } = useLang();
  return {
    lang,
    td: (k: keyof typeof strings.drive, vars?: Record<string, string | number>) => {
      let s = t(lang, strings.drive[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
  };
}

function formatSize(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ItemIcon({ item, className }: { item: DriveItem; className?: string }) {
  const Icon = item.isFolder
    ? Folder
    : item.mimeType.startsWith("image/")
      ? FileImage
      : item.mimeType.startsWith("video/")
        ? FileVideo
        : item.mimeType === "application/pdf" || item.mimeType.startsWith("application/vnd.google-apps")
          ? FileText
          : File;
  return <Icon className={cn("size-4 shrink-0", item.isFolder ? "text-primary" : "text-muted-foreground", className)} />;
}

/**
 * Sube archivos a una carpeta de Drive, directo del navegador (la app solo
 * abre la sesión de subida). Devuelve cuántos subieron y los que fallaron.
 */
export async function uploadFilesToDrive(
  folderId: string,
  files: File[],
  onEach?: () => void,
): Promise<{ done: number; failed: { name: string; error: string }[] }> {
  let done = 0;
  const failed: { name: string; error: string }[] = [];
  for (const file of files) {
    const session = await startDriveUploadAction(folderId, file.name, file.type, file.size);
    if (!session.ok) failed.push({ name: file.name, error: session.error });
    else {
      try {
        const res = await fetch(session.data, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error(String(res.status));
        done++;
      } catch (err) {
        failed.push({ name: file.name, error: err instanceof Error ? err.message : "Error" });
      }
    }
    onEach?.();
  }
  return { done, failed };
}

/**
 * Archivos de un trabajo en Google Drive: la carpeta (se crea la primera vez
 * con `onCreate`), sus subcarpetas para navegar, subir archivos (van directo
 * del navegador a Drive), crear subcarpetas y ver imágenes, PDFs y videos sin
 * salir de la app; lo pesado o de Google Docs se abre en Drive.
 */
export function DriveFiles({
  enabled,
  folderId,
  onCreate,
  className,
}: {
  enabled: boolean;
  folderId: string | null;
  /** Crea la carpeta: devuelve su id y dónde caen los archivos que se suben al crearla (INFORMACION DE CLIENTE). */
  onCreate: () => Promise<{ folderId: string; uploadTo: string } | null>;
  className?: string;
}) {
  const { td } = useTd();
  const [rootId, setRootId] = React.useState(folderId);
  const [creating, setCreating] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /** Sin carpeta todavía: la primera subida la crea (o "Crear carpeta" vacía). */
  async function createAndUpload(files: File[]) {
    setCreating(true);
    const created = await onCreate();
    const id = created?.folderId ?? null;
    if (created && files.length) {
      const { done, failed } = await uploadFilesToDrive(created.uploadTo, files);
      for (const f of failed) toast.error(`${f.name}: ${f.error}`);
      if (done) toast.success(`${td("uploaded")} (${done})`);
    }
    setCreating(false);
    if (inputRef.current) inputRef.current.value = "";
    if (id) setRootId(id);
  }

  /* eslint-disable react-hooks/set-state-in-effect -- otra ficha, otra carpeta. */
  React.useEffect(() => setRootId(folderId), [folderId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!enabled) {
    return <p className={cn("rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground", className)}>{td("not_connected")}</p>;
  }
  if (!rootId) {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-5 text-center", className)}>
        <p className="max-w-sm text-xs text-muted-foreground">{td("create_folder_hint")}</p>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => void createAndUpload([...(e.target.files ?? [])])} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" disabled={creating} onClick={() => inputRef.current?.click()}>
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {creating ? td("creating") : td("upload_files")}
          </Button>
          <Button size="sm" variant="ghost" disabled={creating} onClick={() => void createAndUpload([])}>
            <FolderPlus className="size-3.5" />
            {td("create_folder")}
          </Button>
        </div>
      </div>
    );
  }
  return <FolderBrowser key={rootId} rootId={rootId} className={className} />;
}

function FolderBrowser({ rootId, className }: { rootId: string; className?: string }) {
  const { td, lang } = useTd();
  const [path, setPath] = React.useState<{ id: string; name: string }[]>([{ id: rootId, name: td("root") }]);
  const current = path[path.length - 1];
  const [items, setItems] = React.useState<DriveItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [uploading, setUploading] = React.useState(0);
  const [naming, setNaming] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<DriveItem | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let alive = true;
    void listDriveFolderAction(current.id).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setItems(res.data);
        setError(null);
      } else {
        setItems([]);
        setError(res.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [current.id, reload]);

  const open = (item: DriveItem) => {
    if (item.isFolder) {
      setItems(null);
      setPath((p) => [...p, { id: item.id, name: item.name }]);
    } else setPreview(item);
  };

  async function upload(files: FileList | null) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setUploading(list.length);
    const { done, failed } = await uploadFilesToDrive(current.id, list, () => setUploading((n) => n - 1));
    for (const f of failed) toast.error(`${f.name}: ${f.error}`);
    setUploading(0);
    if (inputRef.current) inputRef.current.value = "";
    if (done) toast.success(`${td("uploaded")} (${done})`);
    setReload((r) => r + 1);
  }

  /** Borrar en dos toques: va a la papelera de Drive (recuperable 30 días). */
  async function remove(item: DriveItem) {
    const res = await trashDriveItemAction(item.id);
    if (!res.ok) return void toast.error(res.error);
    setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
    toast.success(td("deleted"));
  }

  async function createSubfolder() {
    const name = naming?.trim();
    if (!name) return;
    const res = await createDriveSubfolderAction(current.id, name);
    if (!res.ok) return void toast.error(res.error);
    setNaming(null);
    setReload((r) => r + 1);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
          {path.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
              <button
                type="button"
                disabled={i === path.length - 1}
                onClick={() => {
                  setItems(null);
                  setPath((all) => all.slice(0, i + 1));
                }}
                className={cn("max-w-48 truncate rounded px-1", i === path.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {p.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-1.5">
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
          <Button size="sm" variant="outline" disabled={uploading > 0} onClick={() => inputRef.current?.click()}>
            {uploading > 0 ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {uploading > 0 ? td("uploading", { n: uploading }) : td("upload")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNaming("")} title={td("new_folder")}>
            <FolderPlus className="size-3.5" />
            <span className="hidden sm:inline">{td("new_folder")}</span>
          </Button>
          <Button asChild size="sm" variant="ghost" title={td("open_in_drive")} aria-label={td("open_in_drive")}>
            <a href={driveFolderUrl(current.id)} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {naming !== null && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createSubfolder();
              }
              if (e.key === "Escape") setNaming(null);
            }}
            placeholder={td("new_folder_ph")}
          />
          <Button size="sm" onClick={() => void createSubfolder()} disabled={!naming.trim()}>
            {td("add")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNaming(null)}>
            {td("cancel")}
          </Button>
        </div>
      )}

      {items === null ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {td("loading")}
        </p>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          <span>
            {td("error")} <span className="text-destructive">{error}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setReload((r) => r + 1)}>
            {td("retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{td("empty")}</p>
      ) : (
        <ul className="flex max-h-80 flex-col overflow-y-auto rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center border-b border-border pr-3 last:border-0 hover:bg-muted/30">
              <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm">
                {item.hasThumbnail && item.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura de Drive vía la app.
                  <img src={`${fileUrl(item.id)}?thumb=1`} alt="" loading="lazy" className="size-8 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted/50">
                    <ItemIcon item={item} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {[formatSize(item.size), formatDateCompact(lang, item.modifiedTime.slice(0, 10))].filter(Boolean).join(" · ")}
                </span>
                {item.isFolder && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              </button>
              <ConfirmButton
                iconOnly
                label={td("delete")}
                confirmLabel={td("delete_confirm")}
                onConfirm={() => void remove(item)}
              />
            </li>
          ))}
        </ul>
      )}

      <PreviewDialog item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function PreviewDialog({ item, onClose }: { item: DriveItem | null; onClose: () => void }) {
  const { td } = useTd();
  const kind = !item
    ? null
    : (item.size ?? 0) > PREVIEW_MAX
      ? "big"
      : item.mimeType.startsWith("image/")
        ? "image"
        : item.mimeType === "application/pdf"
          ? "pdf"
          : item.mimeType.startsWith("video/")
            ? "video"
            : "other";
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[94vh] max-w-4xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{item?.name}</DialogTitle>
        </DialogHeader>
        {item && (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-muted/40">
              {kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- archivo de Drive vía la app.
                <img src={fileUrl(item.id)} alt={item.name} className="max-h-[72vh] max-w-full object-contain" />
              )}
              {kind === "pdf" && <iframe src={fileUrl(item.id)} title={item.name} className="h-[72vh] w-full rounded-lg bg-card" />}
              {kind === "video" && <video src={fileUrl(item.id)} controls className="max-h-[72vh] max-w-full" />}
              {(kind === "big" || kind === "other") && (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">{kind === "big" ? td("too_big") : td("no_preview")}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {kind !== "other" && !item.mimeType.startsWith("application/vnd.google-apps") && kind !== "big" && (
                <Button asChild size="sm" variant="outline">
                  <a href={fileUrl(item.id)} download={item.name}>
                    <Download className="size-3.5" />
                    {td("download")}
                  </a>
                </Button>
              )}
              <Button asChild size="sm">
                <a href={driveFileUrl(item)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  {td("open_in_drive")}
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Archivos elegidos antes de que exista la carpeta (al crear una
 * oportunidad): se listan aquí y se suben al guardar. Acepta arrastrar.
 */
export function PendingFiles({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const { td } = useTd();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const add = (list: FileList | null) => onChange([...files, ...(list ? [...list] : [])]);
  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-center transition-colors",
          over ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" />
          {td("attach")}
        </Button>
        <p className="max-w-sm text-xs text-muted-foreground">{td("attach_hint")}</p>
      </div>
      {files.length > 0 && (
        <ul className="flex flex-col rounded-lg border border-border">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 border-b border-border px-3 py-1.5 text-sm last:border-0">
              <File className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.size)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={td("remove")}
                title={td("remove")}
                className="flex size-6 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
