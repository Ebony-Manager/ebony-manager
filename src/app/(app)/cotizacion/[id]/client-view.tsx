"use client";

import * as React from "react";

import { EbonyLogo } from "@/components/brand/ebony-logo";
import { formatMoney, lineAmount, lineQty, quoteTotals, sectionLabel, sectionTotals } from "@/lib/cotizador/pricing";
import { strings, t } from "@/lib/i18n";
import type { PdfDetail, Quote } from "@/types/cotizador";
import { UNIT_LABEL } from "./line-row";

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
export function ClientView({ quote, onDetail }: { quote: Quote; onDetail: (d: PdfDetail) => void }) {
  const tt = (k: keyof typeof strings.cotizador) => t(quote.lang, strings.cotizador[k]);
  const totals = quoteTotals(quote);
  const detail = quote.pdfDetail;
  const dateLabel = new Date(`${quote.quoteDate}T12:00:00`).toLocaleDateString(quote.lang === "en" ? "en-US" : "es-PA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-end text-xs text-ink-700">
        {tt("cv_detail")}
        <select
          value={detail}
          onChange={(e) => onDetail(e.currentTarget.value as PdfDetail)}
          className="h-8 border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring"
        >
          <option value="section">{tt("cv_detail_section")}</option>
          <option value="line">{tt("cv_detail_line")}</option>
          <option value="total">{tt("cv_detail_total")}</option>
        </select>
      </label>

      <article className="mx-auto w-full max-w-[860px] border border-ink-900/8 bg-card px-5 py-7 sm:px-10 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-900/16 pb-5">
          <div className="flex flex-col gap-1.5">
            <EbonyLogo variant="wordmark" tone="black" height={34} />
            <span className="text-[10px] tracking-[0.2em] text-ink-700">custom woodwork</span>
          </div>
          <div className="text-right text-xs leading-relaxed text-ink-700">
            <p className="font-semibold text-foreground">EBONY DESIGNS, S.A.</p>
            <p>RUC 155678857-2-2019 DV: 0</p>
            <p>6329-6666 · ventas@ebonypanama.com</p>
            <p>Ave 1A Sur - San Francisco</p>
          </div>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4 py-5">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{tt("cv_quote")}</p>
            <h2 className="text-xl font-semibold text-balance">{quote.clientName || tt("f_client_ph")}</h2>
            {quote.projectName && <p className="text-sm text-ink-700">{quote.projectName}</p>}
            {quote.designerName && <p className="text-xs text-muted-foreground">{quote.designerName}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">{tt("cv_number")}</dt>
            <dd className="text-right font-semibold tabular-nums">{quote.number || "—"}</dd>
            <dt className="text-muted-foreground">{tt("f_date")}</dt>
            <dd className="text-right tabular-nums">{dateLabel}</dd>
            <dt className="text-muted-foreground">{tt("cv_delivery")}</dt>
            <dd className="text-right tabular-nums">
              {quote.deliveryDays} {tt("cv_business_days")}
            </dd>
          </dl>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/16 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                <th className="py-2 pr-3 text-left font-semibold">{tt("cv_item")}</th>
                {detail === "line" && <th className="px-3 py-2 text-right font-semibold">{tt("cv_qty")}</th>}
                {detail !== "total" && <th className="py-2 pl-3 text-right font-semibold">{tt("total")}</th>}
              </tr>
            </thead>
            <tbody>
              {quote.sections.map((s) => {
                const st = sectionTotals(s);
                const cost = st.ebony + st.sub;
                const factor = cost > 0 ? st.total / cost : 0;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="border-b border-ink-900/8 align-top">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold">
                          {s.kind} · {sectionLabel(s) || tt("sec_unnamed")}
                        </p>
                        {s.description && <p className="mt-0.5 max-w-[62ch] text-xs leading-relaxed text-ink-700">{s.description}</p>}
                      </td>
                      {detail === "line" && <td />}
                      {detail !== "total" && <td className="py-2.5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(st.total)}</td>}
                    </tr>
                    {detail === "line" &&
                      s.lines.map((l) => (
                        <tr key={l.id} className="border-b border-ink-900/8 text-xs text-ink-700">
                          <td className="py-1.5 pr-3 pl-4">{l.name}</td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                            {lineQty(l).toLocaleString("en-US", { maximumFractionDigits: 2 })} {UNIT_LABEL[l.unit]}
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
          <dt className="text-ink-700">{tt("subtotal")}</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.subtotal)}</dd>
          {totals.discount > 0 && (
            <>
              <dt className="text-ink-700">{tt("discount")}</dt>
              <dd className="text-right tabular-nums">−{formatMoney(totals.discount)}</dd>
            </>
          )}
          <dt className="text-ink-700">ITBMS ({quote.itbmsPct}%)</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.tax)}</dd>
          <dt className="mt-1 border-t border-ink-900/16 pt-1.5 font-semibold">{tt("total")}</dt>
          <dd className="mt-1 border-t border-ink-900/16 pt-1.5 text-right text-base font-bold tabular-nums">{formatMoney(totals.total)}</dd>
        </dl>

        <footer className="mt-7 border-t border-ink-900/8 pt-4 text-xs leading-relaxed text-ink-700">
          <p>Ebony Designs SA · Banco General – Corriente 03-70-01-127629-2</p>
          <p>{tt("cv_payment")}</p>
        </footer>
      </article>
      <p className="text-center text-xs text-muted-foreground">{tt("cv_pdf_soon")}</p>
    </div>
  );
}
