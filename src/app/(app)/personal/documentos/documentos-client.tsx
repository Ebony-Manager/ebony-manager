"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Download, FileText, Loader2 } from "lucide-react";

import type { DirectoryPerson } from "@/types/staff-directory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb, SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { EmployeeSearchInput } from "../../planilla/employee-search-input";
import { ContractorAvatar } from "../../contratistas/contractor-avatar";
import { buildDocumentsPdf } from "@/lib/personal/documents-pdf";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDate } from "@/lib/planilla/format";
import { countryName } from "@/lib/countries";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

type KindFilter = "all" | DirectoryPerson["kind"];

/**
 * Personal → Documentos: la lista del personal con su documento y datos de
 * contacto — solo lectura, sin dinero. Se marca a varias personas y se
 * descargan sus documentos en un solo PDF (p. ej. para entrar a un
 * edificio). Cada fila se abre para ver nacionalidad, nacimiento, teléfono,
 * correo, dirección y contacto de emergencia.
 */
export function DocumentosClient({ people }: { people: DirectoryPerson[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.documentos) => t(lang, strings.documentos[k]);

  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const key = (p: DirectoryPerson) => `${p.kind}:${p.id}`;
  const hasBothKinds = people.some((p) => p.kind === "employee") && people.some((p) => p.kind === "contractor");

  const visible = React.useMemo(() => {
    const words = query.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/\s+/).filter(Boolean);
    return people.filter((p) => {
      if (!showInactive && !p.active) return false;
      if (kind !== "all" && p.kind !== kind) return false;
      const name = p.name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      return words.every((w) => name.includes(w));
    });
  }, [people, query, kind, showInactive]);

  const chosen = people.filter((p) => selected.has(key(p)));
  const toggle = (p: DirectoryPerson) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key(p))) next.delete(key(p));
      else next.add(key(p));
      return next;
    });

  const docLabel = (p: DirectoryPerson) =>
    p.idDocument
      ? [p.idDocumentType ? tt(p.idDocumentType === "pasaporte" ? "type_pasaporte" : "type_cedula") : "", p.idDocument].filter(Boolean).join(" ")
      : "";
  const groupLabel = (p: DirectoryPerson) => {
    const g = `group_${p.group}` as keyof typeof strings.documentos;
    const base = g in strings.documentos ? tt(g) : p.group;
    return p.position ? `${p.position} · ${base}` : base;
  };

  async function download() {
    const withDoc = chosen.filter((p) => p.documentUrl);
    const missing = chosen.filter((p) => !p.documentUrl);
    if (withDoc.length === 0) {
      toast.error(`${tt("missing_docs")} ${missing.map((p) => p.name).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      const bytes = await buildDocumentsPdf(
        withDoc.map((p) => ({ name: p.name, label: docLabel(p), url: p.documentUrl as string, isPdf: p.documentIsPdf }))
      );
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tt("file_name")} ${todayInPanama()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(tt("downloaded"));
      if (missing.length > 0) toast(`${tt("missing_docs")} ${missing.map((p) => p.name).join(", ")}`, { duration: 8000 });
    } catch (err) {
      console.error("Documentos: no se pudo armar el PDF", err);
      toast.error(tt("download_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      <PageBreadcrumb />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{tt("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tt("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => void download()} disabled={busy || chosen.length === 0}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {busy ? tt("downloading") : `${tt("download")}${chosen.length > 0 ? ` (${chosen.length})` : ""}`}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <EmployeeSearchInput value={query} onChange={setQuery} placeholder={tt("search_ph")} className="w-full max-w-xs" />
        {hasBothKinds && (
          <SegmentedFilter
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: tt("filter_all") },
              { value: "employee", label: tt("filter_employee") },
              { value: "contractor", label: tt("filter_contractor") },
            ]}
          />
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {tt("show_inactive")}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setSelected((cur) => new Set([...cur, ...visible.filter((p) => p.documentUrl).map(key)]))}
          >
            {tt("select_visible")}
          </Button>
          {selected.size > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
              {tt("clear")}
            </Button>
          )}
        </div>
      </div>

      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{tt("empty")}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{tt("no_results")}</p>
      ) : (
        <ul className="flex flex-col rounded-lg border border-border bg-card">
          {visible.map((p) => {
            const k = key(p);
            const isOpen = open === k;
            return (
              <li key={k} className="border-b border-border last:border-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={p.name}
                    checked={selected.has(k)}
                    onChange={() => toggle(p)}
                    className="size-4 shrink-0"
                  />
                  <ContractorAvatar name={p.name} photoUrl={p.photoUrl} size="md" />
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : k)}
                    className="flex min-w-0 flex-[1_1_200px] flex-col text-left"
                    title={tt("details")}
                  >
                    <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                      {isOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                      {p.name}
                      {!p.active && <Badge variant="outline">{tt("inactive")}</Badge>}
                    </span>
                    <span className="truncate pl-5 text-xs text-muted-foreground">{groupLabel(p)}</span>
                  </button>
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className={p.idDocument ? "text-foreground" : "text-muted-foreground/70"}>{docLabel(p) || tt("not_set")}</span>
                    {p.documentUrl ? (
                      <a href={p.documentUrl} target="_blank" rel="noreferrer" title={tt("open_document")} className="block shrink-0">
                        {p.documentIsPdf ? (
                          <span className="flex h-6 items-center gap-1 rounded-sm border border-border px-1.5 text-xs text-muted-foreground hover:bg-muted/40">
                            <FileText className="size-3.5" />
                            PDF
                          </span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage; next/image no aplica.
                          <img src={p.documentUrl} alt={tt("open_document")} className="h-6 w-9 rounded-sm border border-border object-cover hover:opacity-80" />
                        )}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">{tt("no_document")}</span>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-2 border-t border-border bg-muted/20 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Item label={tt("f_nationality")} value={p.nationality ? countryName(p.nationality, lang) : null} empty={tt("not_set")} />
                    <Item label={tt("f_birth")} value={p.birthDate ? formatDate(lang, p.birthDate) : null} empty={tt("not_set")} />
                    <Item label={tt("f_phone")} value={p.phone} empty={tt("not_set")} />
                    <Item label={tt("f_email")} value={p.email} empty={tt("not_set")} />
                    <Item label={tt("f_address")} value={p.address} empty={tt("not_set")} />
                    <Item
                      label={tt("f_emergency")}
                      value={[p.emergencyContactName, p.emergencyContactPhone].filter(Boolean).join(" · ") || null}
                      empty={tt("not_set")}
                    />
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Item({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "break-words text-foreground" : "text-muted-foreground/70"}>{value || empty}</dd>
    </div>
  );
}
