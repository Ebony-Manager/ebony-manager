"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { CloudDownload, ExternalLink, FileText, IdCard, Loader2, MoreHorizontal, Trash2, Upload } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  DOCUMENT_ACCEPT,
  STAFF_DOCUMENTS_BUCKET,
  documentPath,
  isPdfPath,
  type StaffDocumentKind,
} from "@/lib/personal/staff-documents";
import { prepareDocument } from "@/lib/personal/prepare-document";

/**
 * Archivo del documento (foto o PDF de la cédula / pasaporte), en chiquito
 * dentro del dato "Documento" de la ficha (empleado o contratista): una
 * miniatura que se abre en grande en otra pestaña y un menú para cambiarlo o
 * quitarlo; sin archivo, un enlace "Subir foto" (y "Traer de JotForm" si
 * el enlace del formulario quedó en las notas). Sube al bucket privado
 * con la sesión del usuario (la RLS de storage pide el módulo), guarda la
 * ruta con `savePath` y borra el archivo anterior.
 */
export function IdDocumentFile({
  kind,
  ownerId,
  initialPath,
  initialUrl,
  savePath,
  importFromJotform,
}: {
  kind: StaffDocumentKind;
  ownerId: string;
  initialPath: string | null;
  /** URL firmada (1 h) que ya trae el servidor. */
  initialUrl: string | null;
  savePath: (path: string | null) => Promise<unknown>;
  /** Solo si hay un enlace de JotForm en las notas: trae ese archivo a la ficha. */
  importFromJotform?: () => Promise<{ ok: true; path: string; url: string | null } | { ok: false; error: string; status?: number }>;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.common) => t(lang, strings.common[k]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [path, setPath] = React.useState(initialPath);
  const [url, setUrl] = React.useState(initialUrl);
  const [busy, setBusy] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { blob, contentType, ext } = await prepareDocument(file);
      const supabase = createClient();
      const next = documentPath(kind, ownerId, ext);
      const { error } = await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).upload(next, blob, { contentType });
      if (error) throw error;
      await savePath(next);
      if (path) await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).remove([path]);
      const { data } = await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).createSignedUrl(next, 3600);
      setPath(next);
      setUrl(data?.signedUrl ?? null);
      toast.success(tt("doc_saved"));
    } catch (err) {
      console.error("No se pudo guardar el documento", err);
      toast.error(tt("doc_error"));
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!importFromJotform) return;
    setBusy(true);
    try {
      const res = await importFromJotform();
      if (res.ok) {
        setPath(res.path);
        setUrl(res.url);
        toast.success(tt("doc_saved"));
      } else {
        toast.error(importErrorText(res.error, res.status), { duration: 10000 });
      }
    } catch (err) {
      console.error("No se pudo traer el documento de JotForm", err);
      toast.error(tt("doc_import_failed"));
    } finally {
      setBusy(false);
    }
  }

  function importErrorText(error: string, status?: number): string {
    const key = (
      {
        no_key: "doc_import_no_key",
        http: "doc_import_http",
        not_document: "doc_import_not_document",
        too_big: "doc_import_too_big",
      } as Record<string, keyof typeof strings.common>
    )[error];
    const text = tt(key ?? "doc_import_failed");
    return status ? `${text} (${status})` : text;
  }

  async function onRemove() {
    setBusy(true);
    try {
      await savePath(null);
      if (path) await createClient().storage.from(STAFF_DOCUMENTS_BUCKET).remove([path]);
      setPath(null);
      setUrl(null);
      toast.success(tt("doc_removed"));
    } catch (err) {
      console.error("No se pudo quitar el documento", err);
      toast.error(tt("doc_error"));
    } finally {
      setBusy(false);
    }
  }

  const pdf = isPdfPath(path);
  const pick = () => inputRef.current?.click();

  return (
    <div className="mt-1 flex items-center gap-2">
      <input ref={inputRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={onFile} />
      {busy ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : !path ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={pick} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Upload className="size-3.5" />
            {tt("doc_upload_photo")}
          </button>
          {importFromJotform && (
            <button type="button" onClick={() => void onImport()} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <CloudDownload className="size-3.5" />
              {tt("doc_import")}
            </button>
          )}
        </div>
      ) : (
        <>
          {url && !pdf ? (
            <a href={url} target="_blank" rel="noreferrer" title={tt("doc_open")} className="block shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage; next/image no aplica. */}
              <img
                src={url}
                alt={tt("doc_title")}
                className="h-9 w-14 rounded border border-border object-cover transition-opacity hover:opacity-80"
              />
            </a>
          ) : (
            <a
              href={url ?? undefined}
              target="_blank"
              rel="noreferrer"
              title={url ? tt("doc_open") : tt("doc_unavailable")}
              className="flex h-9 items-center gap-1 rounded border border-border px-2 text-xs text-muted-foreground hover:bg-muted/40"
            >
              {pdf ? <FileText className="size-3.5" /> : <IdCard className="size-3.5" />}
              {pdf ? "PDF" : tt("doc_title")}
            </a>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tt("doc_actions")}
                title={tt("doc_actions")}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {url && (
                <DropdownMenuItem asChild>
                  <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    {tt("doc_open")}
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={pick}>
                <Upload className="size-3.5" />
                {tt("doc_change")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => void onRemove()}>
                <Trash2 className="size-3.5" />
                {tt("doc_remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
