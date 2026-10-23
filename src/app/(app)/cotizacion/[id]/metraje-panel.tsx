"use client";

import * as React from "react";
import { ChevronRight, ClipboardCopy } from "lucide-react";
import toast from "react-hot-toast";

import { metraje } from "@/lib/cotizador/metraje";
import { sectionLabel } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { QuotePlan, QuoteSection, Unit } from "@/types/cotizador";

const UNIT: Record<Unit, string> = { m2: "m²", ml: "ML", unidad: "u" };
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Metraje del ítem, plegado por defecto: cuánto hay de cada acabado y de
 * cada tipo de trabajo, para pedirle precio al ebanista o al pintor.
 * "Copiar" deja un texto listo para mandar por WhatsApp o correo.
 */
export function MetrajePanel({ section, plan }: { section: QuoteSection; plan?: QuotePlan }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const [open, setOpen] = React.useState(false);
  const m = React.useMemo(() => metraje(section, plan), [section, plan]);

  const label = (key: string) => {
    const k = `mt_${key}` as keyof typeof strings.cotizador;
    return k in strings.cotizador ? tt(k) : key;
  };
  const text = () =>
    [
      `${tt("mt_title")} — ${sectionLabel(section) || tt("sec_unnamed")}`,
      "",
      `${tt("mt_by_finish")}:`,
      ...m.byFinish.map((r) => `• ${label(r.key)}: ${fmt(r.qty)} ${UNIT[r.unit]}`),
      ...(m.stoneM2 ? [`• ${tt("mt_stone")}: ${fmt(m.stoneM2)} m² (${tt("plan_not_quoted")})`] : []),
      "",
      `${tt("mt_by_work")}:`,
      ...m.byWork.map((r) => `• ${label(r.key)}: ${fmt(r.qty)} ${UNIT[r.unit]}`),
      ...(m.hardware.length ? ["", `${tt("mt_hardware")}:`, ...m.hardware.map((r) => `• ${r.key}: ${fmt(r.qty)} ${UNIT[r.unit]}`)] : []),
      ...(m.subcontracts.length ? ["", `${tt("block_subs")}:`, ...m.subcontracts.map((r) => `• ${r.name}: ${fmt(r.qty)} ${UNIT[r.unit]}`)] : []),
    ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      toast.success(tt("mt_copied"));
    } catch {
      toast.error(tt("mt_copy_failed"));
    }
  }

  const rows = (list: { key: string; qty: number; unit: Unit; name?: string }[], name = (r: { key: string }) => label(r.key)) =>
    list.map((r) => (
      <div key={`${r.key}-${r.unit}`} className="flex justify-between gap-3 border-b border-ink-900/8 py-1 last:border-0">
        <span className="text-ink-700">{name(r)}</span>
        <span className="tabular-nums">
          {fmt(r.qty)} {UNIT[r.unit]}
        </span>
      </div>
    ));

  return (
    <div className="border border-ink-900/8 bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-walnut uppercase">
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          {tt("mt_title")}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {m.byFinish.map((r) => `${label(r.key)} ${fmt(r.qty)} m²`).join(" · ")}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-ink-900/8 p-3.5 text-sm">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{tt("mt_by_finish")}</p>
            {rows(m.byFinish)}
            {m.stoneM2 > 0 && (
              <div className="flex justify-between gap-3 py-1 text-muted-foreground">
                <span>
                  {tt("mt_stone")} <span className="text-[11px]">({tt("plan_not_quoted")})</span>
                </span>
                <span className="tabular-nums">{fmt(m.stoneM2)} m²</span>
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{tt("mt_by_work")}</p>
            {rows(m.byWork)}
          </div>
          {m.hardware.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{tt("mt_hardware")}</p>
              {rows(m.hardware, (r) => r.key)}
            </div>
          )}
          {m.subcontracts.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{tt("block_subs")}</p>
              {rows(m.subcontracts.map((r) => ({ key: r.name, qty: r.qty, unit: r.unit })), (r) => r.key)}
            </div>
          )}
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 self-start rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium hover:border-ink-700">
            <ClipboardCopy className="size-3.5" />
            {tt("mt_copy")}
          </button>
        </div>
      )}
    </div>
  );
}
