"use client";

import { EyeOff } from "lucide-react";

import { BackLink, PAGE_CLASS } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { usePageTitle } from "@/components/shared/page-title";
import { useLang } from "@/context/language-context";
import { formatDateCompact } from "@/lib/planilla/format";
import { photoUrl, THUMB_WIDTH } from "@/lib/photo-url";
import { t, strings } from "@/lib/i18n";
import type { StatusKey } from "@/lib/ui/status";
import type { DesignerQuote, DesignerQuoteLine } from "@/types/designers";
import { projectPath } from "../../../paths";

const UNIT: Record<string, string> = { m2: "m²", ml: "ML", unidad: "u" };
const n = (v: number | null) => (v === null ? "" : String(Number(v.toFixed(3))));

function measures(l: DesignerQuoteLine): string {
  const size = l.width !== null && l.height !== null ? `${n(l.width)} × ${n(l.height)}` : l.width !== null ? n(l.width) : "";
  const amount = l.qty !== null ? `${n(l.qty)}${l.unit ? ` ${UNIT[l.unit] ?? l.unit}` : ""}` : "";
  return [size, l.pieces ? `${n(l.pieces)} pz` : "", amount].filter(Boolean).join(" · ");
}

/** La cotización para una diseñadora: ítems, descripciones, materiales y medidas, imágenes. Ningún monto. */
export function DesignerQuoteView({ projectId, quote }: { projectId: string; quote: DesignerQuote }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  usePageTitle([quote.number, quote.projectName]);

  return (
    <div className={PAGE_CLASS}>
      <BackLink href={projectPath(projectId, "cotizaciones")} label={tt("dq_back")} />

      <div className="flex flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
          <span className="tabular-nums">{quote.number}</span>
          <StatusBadge status={`quote_${quote.status}` as StatusKey}>{tt(`dq_status_${quote.status}` as keyof typeof strings.proyectos)}</StatusBadge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {[quote.projectName, quote.designerName || quote.clientName, quote.quoteDate ? formatDateCompact(lang, quote.quoteDate) : null, quote.deliveryDays ? tt("dq_delivery").replace("{n}", String(quote.deliveryDays)) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <EyeOff className="size-3.5 shrink-0" />
        <span>
          <span className="font-medium text-foreground">{tt("dq_no_prices")}.</span> {tt("dq_hidden_note")}
        </span>
      </p>

      {quote.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tt("dq_no_items")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quote.sections.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {[s.kind, [s.location, s.name].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}
                  </h2>
                  {s.qty > 1 && <span className="text-sm font-medium tabular-nums text-muted-foreground">× {n(s.qty)}</span>}
                </div>
                {s.description?.trim() && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.description.trim()}</p>}
                {s.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {s.images.map((path) => (
                      <a key={path} href={photoUrl("quote-images", path)} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-md border border-border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- ruta propia /api/foto con caché del navegador; next/image no aplica. */}
                        <img src={photoUrl("quote-images", path, THUMB_WIDTH)} alt="" className="size-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {s.lines.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-muted-foreground">{tt("dq_materials")}</p>
                    <ul className="divide-y divide-border rounded-md border border-border text-sm">
                      {s.lines.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-1.5">
                          <span className="text-foreground">
                            {l.name}
                            {l.finish ? <span className="text-muted-foreground"> · {l.finish}</span> : null}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">{measures(l)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
