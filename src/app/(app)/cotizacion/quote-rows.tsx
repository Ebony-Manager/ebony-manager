"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/cotizador/pricing";
import { quoteWho } from "@/lib/cotizador/owner";
import { formatDateCompact } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { QuoteSummary } from "@/types/cotizador";
import { QUOTE_STATUS_STYLE } from "./status-style";

/**
 * Las cotizaciones de un proyecto o de un cliente: número, estado, para quién,
 * fecha y total, cada una con su enlace. Arriba lo aprobado y lo que sigue
 * abierto; con `newHref`, un botón para crear una ya amarrada.
 */
export function QuoteRows({ quotes, newHref, showWho = false }: { quotes: QuoteSummary[]; newHref?: string; showWho?: boolean }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const approved = quotes.filter((q) => q.status === "APROBADA").reduce((s, q) => s + q.total, 0);
  const open = quotes.filter((q) => q.status === "BORRADOR" || q.status === "ENVIADA");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {quotes.length > 0 && (
            <>
              {tt("qr_approved")} <span className="font-semibold text-foreground tabular-nums">{formatMoney(approved)}</span>
              {open.length > 0 && ` · ${tt("qr_open")} ${open.length}`}
            </>
          )}
        </p>
        {newHref && (
          <Button size="sm" asChild>
            <Link href={newHref}>
              <Plus className="size-3.5" />
              {tt("new_quote")}
            </Link>
          </Button>
        )}
      </div>
      {quotes.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground">
          <FileText className="size-4" />
          {tt("qr_none")}
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          {quotes.map((q) => (
            <li key={q.id} className="border-b border-border last:border-0">
              <Link href={`/cotizacion/${q.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm hover:bg-muted/30">
                <span className="font-semibold tabular-nums">{q.number || "—"}</span>
                <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", QUOTE_STATUS_STYLE[q.status])}>{tt(`status_${q.status}`)}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground max-sm:order-last max-sm:basis-full">
                  {[showWho ? quoteWho(q) : null, q.projectName, formatDateCompact(lang, q.quoteDate)].filter(Boolean).join(" · ")}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{formatMoney(q.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
