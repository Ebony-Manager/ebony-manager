"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { FileText, IdCard, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
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
 * Sección "Documento" de la ficha (empleado o contratista): la foto o PDF
 * de la cédula / pasaporte. Se ve en miniatura y se abre en grande en otra
 * pestaña; se sube, se cambia o se quita desde acá. Sube al bucket privado
 * con la sesión del usuario (la RLS de storage pide el módulo), guarda la
 * ruta con `savePath` y borra el archivo anterior.
 */
export function IdDocumentSection({
  kind,
  ownerId,
  initialPath,
  initialUrl,
  savePath,
}: {
  kind: StaffDocumentKind;
  ownerId: string;
  initialPath: string | null;
  /** URL firmada (1 h) que ya trae el servidor. */
  initialUrl: string | null;
  savePath: (path: string | null) => Promise<unknown>;
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

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <input ref={inputRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={onFile} />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{tt("doc_title")}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {path ? tt("doc_change") : tt("doc_upload")}
          </Button>
          {path && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={busy}
              onClick={() => void onRemove()}
              aria-label={tt("doc_remove")}
              title={tt("doc_remove")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {!path ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-6 text-left text-sm text-muted-foreground hover:bg-muted/40"
        >
          <IdCard className="size-6 shrink-0" />
          {tt("doc_empty")}
        </button>
      ) : !url ? (
        <p className="text-sm text-muted-foreground">{tt("doc_unavailable")}</p>
      ) : pdf ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          <FileText className="size-5 text-muted-foreground" />
          {tt("doc_open_pdf")}
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" title={tt("doc_open")} className="block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage; next/image no aplica. */}
          <img
            src={url}
            alt={tt("doc_title")}
            className="max-h-64 max-w-full rounded-md border border-border object-contain transition-opacity hover:opacity-90"
          />
        </a>
      )}
    </section>
  );
}
