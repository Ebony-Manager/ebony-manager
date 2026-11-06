"use client";

import * as React from "react";

import { EbonyLogo } from "@/components/brand/ebony-logo";
import { formatMoney, lineAmount, lineQty, quoteTotals, sectionLabel, sectionTotals } from "@/lib/cotizador/pricing";
import { strings, t } from "@/lib/i18n";
import type { PdfDetail, Quote, QuoteImage } from "@/types/cotizador";
import { photoUrl, THUMB_WIDTH } from "@/lib/photo-url";
import { UNIT_LABEL } from "./line-row";
import { quoteWho, validUntil } from "@/lib/cotizador/owner";
import { groupedOrder } from "@/lib/cotizador/items";
import { TERMS, TERMS_INTRO, TERMS_TITLE, richSegments } from "@/lib/cotizador/terms";
import toast from "react-hot-toast";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/context/language-context";
import { downloadQuotePdf } from "./quote-pdf";

/**
 * Lo que ve el cliente: una línea por ítem con su descripción, como la
 * cotización que hoy sale de Alegra. Se muestra en el idioma elegido
 * para la cotización (no en el de la interfaz). El nivel de detalle
 * —precio por ítem, por renglón o solo el total— se elige por cotización.
 *
 * Al mostrar precio por renglón, la utilidad y los extras del ítem se
 * reparten proporcionalmente entre sus renglones: el cliente nunca ve
 * costos ni márgenes, y la suma sigue dando el total del ítem.
 */
export function ClientView({ quote, onDetail, images = [] }: { quote: Quote; onDetail: (d: PdfDetail) => void; images?: QuoteImage[] }) {
  // La primera imagen de cada ítem va a su izquierda.
  const firstImage = new Map<string, QuoteImage>();
  for (const im of [...images].sort((a, b) => a.sortOrder - b.sortOrder)) if (!firstImage.has(im.sectionId)) firstImage.set(im.sectionId, im);
  const tt = (k: keyof typeof strings.cotizador) => t(quote.lang, strings.cotizador[k]);
  const totals = quoteTotals(quote);
  // Con algún ítem de cantidad mayor a 1, se muestran cantidad y precio unitario.
  const hasQty = quote.sections.some((s) => s.qty > 1);
  const detail = quote.pdfDetail;
  const fmtDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(quote.lang === "en" ? "en-US" : "es-PA", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateLabel = fmtDate(quote.quoteDate);
  // Los botones van en el idioma de la interfaz; la cotización, en el suyo.
  const { lang } = useLang();
  const ui = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const [building, setBuilding] = React.useState(false);
  async function download() {
    setBuilding(true);
    try {
      await downloadQuotePdf(quote, images);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-foreground/80">{ui("cv_detail")}</span>
        <Select value={detail} onValueChange={(v) => onDetail(v as PdfDetail)}>
          <SelectTrigger size="sm" className="w-[170px]" aria-label={ui("cv_detail")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="section">{ui("cv_detail_section")}</SelectItem>
            <SelectItem value="line">{ui("cv_detail_line")}</SelectItem>
            <SelectItem value="total">{ui("cv_detail_total")}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => void download()} disabled={building}>
          {building ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {building ? ui("pdf_building") : ui("pdf_download")}
        </Button>
      </div>

      <article className="mx-auto w-full max-w-[860px] rounded-lg border border-border bg-card px-5 py-7 sm:px-10 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-1.5">
            <EbonyLogo variant="wordmark" tone="black" height={34} />
            <span className="text-[10px] tracking-[0.2em] text-foreground/80">custom woodwork</span>
          </div>
          <div className="text-right text-xs leading-relaxed text-foreground/80">
            <p className="font-semibold text-foreground">EBONY DESIGNS, S.A.</p>
            <p>RUC 155678857-2-2019 DV: 0</p>
            <p>6329-6666 · ventas@ebonypanama.com</p>
            <p>Ave 1A Sur - San Francisco</p>
          </div>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4 py-5">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{tt("cv_quote")}</p>
            <h2 className="text-xl font-semibold text-balance">{quoteWho(quote) || "—"}</h2>
            {quote.projectName && <p className="text-sm text-foreground/80">{quote.projectName}</p>}
            {quote.clientName && quote.designerName && <p className="text-xs text-muted-foreground">{quote.designerName}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">{tt("cv_number")}</dt>
            <dd className="text-right font-semibold tabular-nums">{quote.number || "—"}</dd>
            <dt className="text-muted-foreground">{tt("f_date")}</dt>
            <dd className="text-right tabular-nums">{dateLabel}</dd>
            <dt className="text-muted-foreground">{tt("valid_until")}</dt>
            <dd className="text-right tabular-nums">{fmtDate(validUntil(quote.quoteDate, quote.validDays))}</dd>
            <dt className="text-muted-foreground">{tt("cv_delivery")}</dt>
            <dd className="text-right tabular-nums">
              {quote.deliveryDays} {tt("cv_business_days")}
            </dd>
          </dl>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                <th className="py-2 pr-3 text-left font-semibold">{tt("cv_item")}</th>
                {(detail === "line" || hasQty) && <th className="px-3 py-2 text-right font-semibold">{tt("cv_qty")}</th>}
                {detail === "section" && hasQty && <th className="px-3 py-2 text-right font-semibold">{tt("cv_unit_price")}</th>}
                {detail !== "total" && <th className="py-2 pl-3 text-right font-semibold">{tt("total")}</th>}
              </tr>
            </thead>
            <tbody>
              {groupedOrder(quote.sections).map((s) => {
                const st = sectionTotals(s);
                const cost = st.ebony + st.sub;
                // Por renglón: lo de una unidad, repartido, por la cantidad del ítem.
                const factor = cost > 0 ? (st.unit / cost) * st.qty : 0;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="border-b border-border align-top">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-start gap-3">
                          {firstImage.has(s.id) && (
                            <a href={photoUrl("quote-images", firstImage.get(s.id)!.path)} target="_blank" rel="noreferrer" className="shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de /api/foto (achicada y en caché). */}
                              <img src={photoUrl("quote-images", firstImage.get(s.id)!.path, THUMB_WIDTH)} alt="" className="size-16 rounded-md border border-border object-cover sm:size-20" />
                            </a>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {s.kind} · {sectionLabel(s) || tt("sec_unnamed")}
                            </p>
                            {s.description && <p className="mt-0.5 max-w-[62ch] text-xs leading-relaxed text-foreground/80">{s.description}</p>}
                          </div>
                        </div>
                      </td>
                      {(detail === "line" || hasQty) && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{detail === "line" ? (st.qty > 1 ? `× ${st.qty}` : "") : st.qty}</td>
                      )}
                      {detail === "section" && hasQty && <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatMoney(st.unit)}</td>}
                      {detail !== "total" && <td className="py-2.5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(st.total)}</td>}
                    </tr>
                    {detail === "line" &&
                      s.lines.map((l) => (
                        <tr key={l.id} className="border-b border-border text-xs text-foreground/80">
                          <td className="py-1.5 pr-3 pl-4">{l.name}</td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                            {(lineQty(l) * st.qty).toLocaleString("en-US", { maximumFractionDigits: 2 })} {UNIT_LABEL[l.unit]}
                          </td>
                          <td className="py-1.5 pl-3 text-right whitespace-nowrap tabular-nums">{formatMoney(lineAmount(l) * factor)}</td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 ml-auto grid w-full max-w-[300px] grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-foreground/80">{tt("subtotal")}</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.subtotal)}</dd>
          {totals.discount > 0 && (
            <>
              <dt className="text-foreground/80">{tt("discount")}</dt>
              <dd className="text-right tabular-nums">−{formatMoney(totals.discount)}</dd>
            </>
          )}
          <dt className="text-foreground/80">ITBMS ({quote.itbmsPct}%)</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.tax)}</dd>
          <dt className="mt-1 border-t border-border pt-1.5 font-semibold">{tt("total")}</dt>
          <dd className="mt-1 border-t border-border pt-1.5 text-right text-base font-bold tabular-nums">{formatMoney(totals.total)}</dd>
        </dl>

        {quote.notes.trim() && <p className="mt-6 text-sm leading-relaxed whitespace-pre-line text-foreground/80">{quote.notes.trim()}</p>}

        <footer className="mt-7 border-t border-border pt-4 text-xs leading-relaxed text-foreground/80">
          <p>Ebony Designs SA · Banco General – Corriente 03-70-01-127629-2</p>
          <p>{tt("cv_payment")}</p>
        </footer>

        {/* Condiciones generales (en el PDF van en hojas aparte). */}
        <details className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-foreground/80">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">{TERMS_TITLE}</summary>
          <p className="mt-3 italic">{TERMS_INTRO}</p>
          {TERMS.map((section) => (
            <section key={section.title} className="mt-3">
              <h3 className="font-semibold text-foreground">{section.title}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {section.items.map((item, i) => (
                  <li key={i}>
                    <Rich text={typeof item === "string" ? item : item.text} />
                    {typeof item !== "string" && (
                      <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
                        {item.sub.map((sub) => (
                          <li key={sub}>
                            <Rich text={sub} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </details>
      </article>
    </div>
  );
}

/** Texto con `**negritas**`. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {richSegments(text).map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {seg.text}
          </strong>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </>
  );
}
