"use client";

import { SearchInput, ListToolbar } from "@/components/shared/search-input";
import { matchesSearch, normalizeSearchText } from "@/lib/search";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Copy, FileText, Plus, Trash2 } from "lucide-react";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/cotizador/pricing";
import { quoteWho } from "@/lib/cotizador/owner";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { QUOTE_STATUSES, type QuoteStatus, type QuoteSummary } from "@/types/cotizador";
import { deleteQuoteAction, duplicateQuoteAction } from "./actions";
import { RowMenu } from "@/components/shared/row-menu";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { CotizacionTabs } from "./ventas-common";
import { QUOTE_STATUS_STYLE } from "./status-style";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";


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
    const q = normalizeSearchText(search);
    return quotes.filter((x) => {
      if (filter !== "all" && x.status !== filter) return false;
      if (!q) return true;
      return [x.clientName, x.projectName, x.designerName, x.number].some((v) => matchesSearch(v, q));
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

  // Duplicar y eliminar dentro del "⋯" de cada fila (no como íconos sueltos).
  const actions = (id: string) => (
    <RowMenu
      label={tt("more_actions")}
      items={[
        { label: tt("duplicate_version"), icon: Copy, disabled: busy === id, onSelect: () => void onDuplicate(id) },
        { label: tt("delete"), icon: Trash2, confirmLabel: tt("delete_confirm"), onSelect: () => void onDelete(id) },
      ]}
    />
  );
  // Enviada y ya le toca seguimiento (a los 7 días de enviada).
  const today = todayInPanama();
  const followUp = (q: QuoteSummary) =>
    q.followUpOn && q.followUpOn <= today ? (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[color-mix(in_oklab,var(--status-warn)_20%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-foreground">
        <BellRing className="size-3" />
        {tt("follow_up_due")}
      </span>
    ) : null;
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
      <CotizacionTabs value="cotizaciones" />

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
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <FileText className="size-6 text-primary" />
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
            <li key={q.id} className="border-b border-border px-3.5 py-2.5 last:border-0 hover:bg-muted/30">
              {/* Celular: cliente y total arriba; fecha, número, estado y acciones abajo. */}
              <div className="flex flex-col gap-1.5 sm:hidden">
                <div className="flex items-start gap-3">
                  <Link prefetch={false} href={`/cotizacion/${q.id}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-foreground">{quoteWho(q) || tt("own_none")}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[q.projectName, q.clientName ? q.designerName : ""].filter(Boolean).join(" · ") || tt("no_project")}
                    </span>
                  </Link>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(q.total)}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-xs text-foreground/80">
                  <span className="shrink-0">{date(q.quoteDate)}</span>
                  {q.number && <span className="min-w-0 truncate tabular-nums">· {q.number}</span>}
                  <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold", QUOTE_STATUS_STYLE[q.status])}>{tt(`status_${q.status}`)}</span>
                  {followUp(q)}
                  <span className="ml-auto flex shrink-0 items-center">{actions(q.id)}</span>
                </div>
              </div>
              {/* Computadora: todo en una fila. */}
              <div className="hidden items-center gap-x-4 sm:flex">
                <Link prefetch={false} href={`/cotizacion/${q.id}`} className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-foreground">{quoteWho(q) || tt("own_none")}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[q.projectName, q.clientName ? q.designerName : ""].filter(Boolean).join(" · ") || tt("no_project")}
                  </span>
                </Link>
                <span className="w-24 shrink-0 truncate text-xs text-foreground/80 tabular-nums" title={q.number ?? undefined}>
                  {q.number || "—"}
                </span>
                <span className="w-24 shrink-0 text-xs text-foreground/80">{date(q.quoteDate)}</span>
                <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold", QUOTE_STATUS_STYLE[q.status])}>{tt(`status_${q.status}`)}</span>
                  {followUp(q)}
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums">{formatMoney(q.total)}</span>
                <span className="flex shrink-0 items-center">{actions(q.id)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
