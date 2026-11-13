"use client";

import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import { EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLang } from "@/context/language-context";
import { formatDateCompact } from "@/lib/planilla/format";
import { t, strings } from "@/lib/i18n";
import type { StatusKey } from "@/lib/ui/status";
import type { DesignerQuoteSummary } from "@/types/designers";

/** Las cotizaciones del proyecto para una diseñadora: número, estado, fecha y cuántos ítems. Sin montos. */
export function DesignerQuoteRows({ projectId, quotes }: { projectId: string; quotes: DesignerQuoteSummary[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  if (quotes.length === 0) return <EmptyState>{tt("dq_empty")}</EmptyState>;
  return (
    <ul className="flex flex-col gap-2">
      {quotes.map((q) => (
        <li key={q.id}>
          <Link
            href={`/proyectos/${projectId}/cotizacion/${q.id}`}
            prefetch={false}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-ring"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tabular-nums text-foreground">{q.number}</span>
                <StatusBadge status={`quote_${q.status}` as StatusKey}>{tt(`dq_status_${q.status}` as keyof typeof strings.proyectos)}</StatusBadge>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[q.designerName || q.clientName, q.quoteDate ? formatDateCompact(lang, q.quoteDate) : null, tt("dq_items").replace("{n}", String(q.items))].filter(Boolean).join(" · ")}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
