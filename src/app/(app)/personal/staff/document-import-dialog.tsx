"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, FolderUp, Loader2, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { matchPersonByName } from "@/lib/personal/jotform-intake";
import {
  DOCUMENT_ACCEPT,
  STAFF_DOCUMENTS_BUCKET,
  documentPath,
  groupImportFiles,
  type StaffDocumentKind,
} from "@/lib/personal/staff-documents";
import { prepareDocument } from "@/lib/personal/prepare-document";
import { updateEmployeeAction } from "../../planilla/actions";
import { updateContractorAction } from "../../contratistas/actions";

/** Alguien del staff a quien se le puede cargar documento. */
export interface DocumentPerson {
  kind: StaffDocumentKind;
  id: string;
  name: string;
  idDocumentPath: string | null;
}

interface Row {
  name: string;
  file: File;
  /** `${kind}:${id}` o "" = no cargar. */
  target: string;
  replace: boolean;
  status: "idle" | "uploading" | "done" | "error";
}

const NONE = "__none__";

/**
 * Cargar documentos de varias personas de una vez: se elige la carpeta
 * "Vigente" de Drive (una subcarpeta por persona) o archivos sueltos con el
 * nombre de la persona. Cada subcarpeta se empareja sola con alguien del
 * staff (se puede corregir), se toma la foto del documento (no la firma) y se
 * sube a su ficha. A quien ya tiene documento no se le cambia, salvo que se
 * marque "Reemplazar".
 */
export function DocumentImportDialog({ people }: { people: DocumentPerson[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);
  const router = useRouter();
  const folderRef = React.useRef<HTMLInputElement>(null);
  const filesRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [running, setRunning] = React.useState(false);

  const byKey = React.useMemo(() => new Map(people.map((p) => [`${p.kind}:${p.id}`, p])), [people]);
  const sorted = React.useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name, "es")), [people]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    const files = list.map((file) => ({ file, path: file.webkitRelativePath || file.name, size: file.size }));
    const groups = groupImportFiles(files).filter((g): g is { name: string; file: (typeof files)[number] } => g.file !== null);
    setRows(
      groups
        .map((g) => {
          const person = matchPersonByName(g.name, people);
          return {
            name: g.name,
            file: g.file.file,
            target: person ? `${person.kind}:${person.id}` : "",
            replace: false,
            status: "idle" as const,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    );
  }

  const willUpload = (r: Row) => {
    const p = r.target ? byKey.get(r.target) : undefined;
    return Boolean(p && (!p.idDocumentPath || r.replace));
  };
  const pending = rows.filter((r) => r.status !== "done" && willUpload(r));

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function run() {
    setRunning(true);
    const supabase = createClient();
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.status === "done" || !willUpload(r)) continue;
      const person = byKey.get(r.target)!;
      update(i, { status: "uploading" });
      try {
        const { blob, contentType, ext } = await prepareDocument(r.file);
        const path = documentPath(person.kind, person.id, ext);
        const { error } = await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).upload(path, blob, { contentType });
        if (error) throw error;
        if (person.kind === "employee") await updateEmployeeAction(person.id, { idDocumentPath: path });
        else await updateContractorAction(person.id, { idDocumentPath: path });
        if (person.idDocumentPath) await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).remove([person.idDocumentPath]);
        person.idDocumentPath = path;
        update(i, { status: "done" });
        ok++;
      } catch (err) {
        console.error("No se pudo cargar el documento de", r.name, err);
        update(i, { status: "error" });
        failed++;
      }
    }
    setRunning(false);
    if (ok) toast.success(`${ok} ${tt("docs_import_done")}`);
    if (failed) toast.error(`${failed} ${tt("docs_import_failed")}`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FolderUp className="size-3.5" />
        {tt("docs_import")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (running) return;
          setOpen(o);
          if (!o) setRows([]);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tt("docs_import_title")}</DialogTitle>
            <DialogDescription>{tt("docs_import_desc")}</DialogDescription>
          </DialogHeader>

          <input
            ref={(el) => {
              folderRef.current = el;
              // `webkitdirectory` (elegir una carpeta) no está en los tipos de React: se pone a mano.
              el?.setAttribute("webkitdirectory", "");
            }}
            type="file"
            multiple
            className="hidden"
            onChange={onFiles}
          />
          <input ref={filesRef} type="file" multiple accept={DOCUMENT_ACCEPT} className="hidden" onChange={onFiles} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={running} onClick={() => folderRef.current?.click()}>
              <FolderUp className="size-3.5" />
              {tt("docs_pick_folder")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => filesRef.current?.click()}>
              {tt("docs_pick_files")}
            </Button>
          </div>

          {rows.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {rows.map((r, i) => {
                const person = r.target ? byKey.get(r.target) : undefined;
                return (
                  <li key={`${r.name}-${i}`} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.file.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={r.target || NONE}
                        onValueChange={(v) => update(i, { target: v === NONE ? "" : v, status: "idle" })}
                        disabled={running || r.status === "done"}
                      >
                        <SelectTrigger className="h-8 w-56 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{tt("docs_skip")}</SelectItem>
                          {sorted.map((p) => (
                            <SelectItem key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
                              {p.name} · {tt(p.kind === "employee" ? "kind_employee" : "kind_contractor")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="flex w-5 justify-center">
                        {r.status === "uploading" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                        {r.status === "done" && <Check className="size-4 text-emerald-600" />}
                        {r.status === "error" && <X className="size-4 text-destructive" />}
                      </span>
                    </div>
                    {person?.idDocumentPath && r.status !== "done" && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:w-full sm:basis-full">
                        <input
                          type="checkbox"
                          checked={r.replace}
                          disabled={running}
                          onChange={(e) => update(i, { replace: e.target.checked })}
                        />
                        {tt("docs_has_document")}
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={running} onClick={() => setOpen(false)}>
              {tt("docs_close")}
            </Button>
            <Button type="button" disabled={running || pending.length === 0} onClick={() => void run()}>
              {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {tt("docs_upload")} ({pending.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
