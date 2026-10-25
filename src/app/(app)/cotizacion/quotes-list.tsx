"use client";

import { SearchInput, ListToolbar } from "@/components/shared/search-input";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { QUOTE_STATUSES, type QuoteStatus, type QuoteSummary } from "@/types/cotizador";
import { deleteQuoteAction, duplicateQuoteAction } from "./actions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";

const STATUS_STYLE: Record<QuoteStatus, string> = {
  BORRADOR: "bg-stone-200 text-ink-700",
  ENVIADA: "bg-cream-100 text-walnut",
  APROBADA: "bg-[color-mix(in_srgb,var(--status-ok)_18%,white)] text-[var(--status-ok)]",
  RECHAZADA: "bg-[color-mix(in_srgb,var(--status-error)_14%,white)] text-[var(--status-error)]",
};

/** Lista de cotizaciones: buscar, filtrar por estado, abrir, duplicar y borrar. */
export function QuotesList({ initialQuotes, canEditCosts }: { initialQuotes: QuoteSummary[]; canEditCosts: boolean }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const router = useRouter();

  const [quotes, setQuotes] = React.useState(initialQuotes);
  const [filter, setFilter] = React.useState<QuoteStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const shown = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((x) => {
      if (filter !== "all" && x.status !== filter) return false;
      if (!q) return true;
      return [x.clientName, x.projectName, x.designerName, x.number].some((v) => v.toLowerCase().includes(q));
    });
  }, [quotes, filter, search]);

  // No crea nada todavía: el editor guarda la cotización con el primer cambio.
  function onNew() {
    setBusy("new");
    router.push("/cotizacion/nueva");
  }
  async function onDuplicate(id: string) {
    setBusy(id);
    try {
      router.push(`/cotizacion/${await duplicateQuoteAction(id)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      setBusy(null);
    }
  }
  // Optimista: la fila se quita ya; si el borrado falla, vuelve.
  async function onDelete(id: string) {
    const before = quotes;
    setQuotes((list) => list.filter((x) => x.id !== id));
    try {
      await deleteQuoteAction(id);
      toast.success(tt("deleted"));
    } catch (err) {
      setQuotes(before);
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  const date = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={tt("title")}
        subtitle={tt("subtitle")}
        action={
          <>
            {canEditCosts && (
              <Button size="sm" variant="ghost" asChild>
                <Link href="/cotizacion/costos">{tt("costs_link")}</Link>
              </Button>
            )}
            <Button size="sm" onClick={onNew} disabled={busy === "new"}>
              <Plus className="size-3.5" />
              {tt("new_quote")}
            </Button>
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder={tt("search_ph")} className="w-full flex-[1_1_220px] sm:max-w-xs" />
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={(["all", ...QUOTE_STATUSES] as const).map((f) => ({ value: f, label: f === "all" ? tt("filter_all") : tt(`status_${f}`) }))}
        />
      </ListToolbar>

      {quotes.length === 0 ? (
        <EmptyState className="py-14">
          <div className="flex size-14 items-center justify-center rounded-full bg-cream-100">
            <FileText className="size-6 text-walnut" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{tt("empty_title")}</p>
            <p>{tt("empty_body")}</p>
          </div>
          <Button size="sm" onClick={onNew} disabled={busy === "new"}>
            <Plus className="size-3.5" />
            {tt("new_quote")}
          </Button>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{tt("no_results")}</EmptyState>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          {shown.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3.5 py-2.5 last:border-0 hover:bg-muted/30">
              <Link href={`/cotizacion/${q.id}`} className="flex min-w-0 flex-[1_1_260px] flex-col">
                <span className="truncate font-semibold text-foreground">{q.clientName || tt("f_client_ph")}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[q.projectName, q.designerName].filter(Boolean).join(" · ") || tt("no_project")}
                </span>
              </Link>
              <span className="w-16 text-xs text-ink-700 tabular-nums">{q.number ? `Nº ${q.number}` : "—"}</span>
              <span className="w-24 text-xs text-ink-700">{date(q.quoteDate)}</span>
              <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[q.status])}>{tt(`status_${q.status}`)}</span>
              <span className="ml-auto w-28 text-right text-sm font-semibold tabular-nums">{formatMoney(q.total)}</span>
              <span className="flex items-center">
                <button type="button" title={tt("duplicate")} aria-label={tt("duplicate")} disabled={busy === q.id} onClick={() => onDuplicate(q.id)} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40">
                  <Copy className="size-3.5" />
                </button>
                <ConfirmButton iconOnly icon={Trash2} label={tt("delete")} confirmLabel={tt("delete_confirm")} onConfirm={() => onDelete(q.id)} className="p-1.5" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
