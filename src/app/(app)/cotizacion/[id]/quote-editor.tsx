"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import toast from "react-hot-toast";

import { formatMoney, newSection, quoteTotals, sectionTotals, syncDraftPrices } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { QUOTE_STATUSES, type CatalogItem, type Quote, type QuoteDefaults, type QuoteSection, type QuoteStatus } from "@/types/cotizador";
import { createQuoteAction, duplicateQuoteAction, saveQuoteAction } from "../actions";
import { NumField } from "../num-field";
import { ClientView } from "./client-view";
import { SectionEditor, type BlockKey } from "./section-editor";
import { Viewer3D } from "./viewer-3d";
import { BackLink, PAGE_CLASS, SubTabs } from "@/components/shared/page-header";

type SaveState = "saved" | "pending" | "saving" | "error";
const SAVE_DELAY_MS = 700;

/**
 * Editor de una cotización. Todo es optimista: cada cambio se ve al
 * instante en pantalla y se guarda solo, en segundo plano, a los 0.7 s
 * de dejar de escribir (la cotización completa en una sola llamada). Los
 * guardados van en fila: si llega un cambio mientras uno está en curso,
 * se manda otro al terminar con la versión más reciente.
 *
 * Una cotización nueva (`isNew`, abierta desde /cotizacion/nueva) todavía no
 * existe en la base: se crea con el primer cambio. Si el usuario sale sin
 * tocar nada, no queda ningún borrador vacío.
 */
export function QuoteEditor({
  initialQuote,
  isNew = false,
  catalog,
  defaults,
  canEditCosts,
}: {
  initialQuote: Quote;
  isNew?: boolean;
  catalog: CatalogItem[];
  defaults: QuoteDefaults;
  canEditCosts: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const router = useRouter();

  const [quote, setQuote] = React.useState(() => syncDraftPrices(initialQuote, catalog));
  const [currentId, setCurrentId] = React.useState<string | null>(initialQuote.sections[0]?.id ?? null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"edit" | "client">("edit");
  const [open, setOpen] = React.useState<Record<BlockKey, boolean>>({ eb: true, sb: true, ex: false, mg: false });
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [duplicating, setDuplicating] = React.useState(false);
  const [isPersisted, setIsPersisted] = React.useState(!isNew);

  const latest = React.useRef(quote);
  const timer = React.useRef<number | null>(null);
  const inFlight = React.useRef(false);
  const queued = React.useRef(false);
  const persisted = React.useRef(!isNew);
  const creating = React.useRef<Promise<void> | null>(null);

  // El primer guardado de una cotización nueva la crea y deja la dirección
  // en /cotizacion/<id> (sin recargar); los siguientes la actualizan. Si se
  // pide guardar mientras se está creando (ej. al salir de la pantalla), se
  // espera a que termine para no crearla dos veces. Al salir no se toca la
  // dirección: ya es la de otra página.
  async function persist(q: Quote, { updateUrl = true } = {}) {
    if (!persisted.current && creating.current) await creating.current.catch(() => {});
    if (persisted.current) return saveQuoteAction(q);
    creating.current = createQuoteAction(q);
    try {
      await creating.current;
    } finally {
      creating.current = null;
    }
    persisted.current = true;
    setIsPersisted(true);
    if (updateUrl) window.history.replaceState(null, "", `/cotizacion/${q.id}`);
  }

  async function flush() {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setSaveState("saving");
    try {
      do {
        queued.current = false;
        await persist(latest.current);
      } while (queued.current);
      if (timer.current === null) setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      inFlight.current = false;
    }
  }

  function change(fn: (q: Quote) => Quote) {
    const next = fn(latest.current);
    latest.current = next;
    setQuote(next);
    setSaveState("pending");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void flush();
    }, SAVE_DELAY_MS);
  }

  // Al salir de la pantalla con un cambio todavía en espera, se guarda ya.
  React.useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
        void persist(latest.current, { updateUrl: false }).catch(() => {});
      }
    };
  }, []);
  React.useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const section = quote.sections.find((s) => s.id === currentId) ?? quote.sections[0] ?? null;
  const totals = quoteTotals(quote);
  const secTotals = section ? sectionTotals(section) : null;

  const setHeader = (p: Partial<Quote>) => change((q) => ({ ...q, ...p }));
  const setSection = (next: QuoteSection) => change((q) => ({ ...q, sections: q.sections.map((s) => (s.id === next.id ? next : s)) }));
  const patchSection = (id: string, fn: (s: QuoteSection) => QuoteSection) =>
    change((q) => ({ ...q, sections: q.sections.map((s) => (s.id === id ? fn(s) : s)) }));

  const addSection = () => {
    const id = crypto.randomUUID();
    change((q) => ({ ...q, sections: [...q.sections, newSection(id, defaults, section?.location ?? "")] }));
    setCurrentId(id);
    setConfirmDelete(null);
  };
  const removeSection = (id: string) => {
    const idx = quote.sections.findIndex((s) => s.id === id);
    const rest = quote.sections.filter((s) => s.id !== id);
    change((q) => ({ ...q, sections: q.sections.filter((s) => s.id !== id) }));
    if (currentId === id) setCurrentId(rest[Math.max(0, idx - 1)]?.id ?? null);
    setConfirmDelete(null);
  };

  async function onDuplicate() {
    setDuplicating(true);
    try {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
        await persist(latest.current);
        setSaveState("saved");
      }
      const id = await duplicateQuoteAction(quote.id);
      toast.success(tt("duplicated"));
      router.push(`/cotizacion/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDuplicating(false);
    }
  }

  const statusLabel = (s: QuoteStatus) => tt(`status_${s}`);
  const smallLabel = "flex min-w-0 flex-col gap-1 text-[11px] font-medium text-ink-700";
  const smallInput = "h-8 w-full min-w-0 border border-input bg-card px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";
  const panelTitle = "text-[11px] font-semibold tracking-[0.08em] text-walnut uppercase";
  const money = "text-right tabular-nums";

  const nameCell = (s: Pick<QuoteSection, "location" | "name">) => (
    <span className="flex min-w-0 items-baseline gap-1.5">
      {s.location && <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{s.location}</span>}
      <span className="truncate font-semibold text-foreground">{s.name || tt("sec_unnamed")}</span>
    </span>
  );

  return (
    <div className={PAGE_CLASS}>
      {/* Encabezado: el cliente es lo que más se ve */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink href="/cotizacion" label={tt("title")} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              {saveState === "saved" && isPersisted && <Check className="size-3.5 text-[var(--status-ok)]" />}
              {(saveState === "saving" || saveState === "pending") && <Loader2 className="size-3.5 animate-spin" />}
              {saveState === "error" && <TriangleAlert className="size-3.5 text-destructive" />}
              {saveState === "saved" ? tt(isPersisted ? "save_saved" : "save_new") : saveState === "error" ? tt("save_error") : tt("save_saving")}
              {saveState === "error" && (
                <button type="button" onClick={() => void flush()} className="underline">
                  {tt("save_retry")}
                </button>
              )}
            </span>
            <select
              value={quote.status}
              aria-label={tt("f_status")}
              onChange={(e) => setHeader({ status: e.currentTarget.value as QuoteStatus })}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs font-semibold outline-none focus-visible:border-ring"
            >
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={duplicating || !isPersisted}
              onClick={onDuplicate}
              title={tt("duplicate_hint")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:border-ink-700 disabled:opacity-50"
            >
              <Copy className="size-3.5" />
              {tt("duplicate")}
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          <input
            value={quote.clientName}
            onChange={(e) => setHeader({ clientName: e.currentTarget.value })}
            placeholder={tt("f_client_ph")}
            aria-label={tt("f_client")}
            className="w-full min-w-0 border-b border-transparent bg-transparent pb-0.5 text-xl font-semibold text-foreground outline-none placeholder:text-ink-900/25 hover:border-border focus-visible:border-ink-900"
          />
          <input
            value={quote.projectName}
            onChange={(e) => setHeader({ projectName: e.currentTarget.value })}
            placeholder={tt("f_project_ph")}
            aria-label={tt("f_project")}
            className="w-full min-w-0 border-b border-transparent bg-transparent pt-1 pb-0.5 text-sm text-ink-700 outline-none placeholder:text-ink-900/30 hover:border-border focus-visible:border-ink-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[130px_150px_minmax(0,1fr)_130px_130px]">
          <label className={smallLabel}>
            {tt("f_number")}
            <input className={smallInput} value={quote.number} onChange={(e) => setHeader({ number: e.currentTarget.value })} />
          </label>
          <label className={smallLabel}>
            {tt("f_date")}
            <input type="date" className={smallInput} value={quote.quoteDate} onChange={(e) => e.currentTarget.value && setHeader({ quoteDate: e.currentTarget.value })} />
          </label>
          <label className={smallLabel}>
            {tt("f_designer")}
            <input className={smallInput} value={quote.designerName} placeholder={tt("f_designer_ph")} onChange={(e) => setHeader({ designerName: e.currentTarget.value })} />
          </label>
          <label className={smallLabel}>
            {tt("f_delivery")}
            <NumField value={quote.deliveryDays} onChange={(n) => setHeader({ deliveryDays: Math.round(n) })} suffix={tt("unit_days")} inputWidth={40} className="h-8 justify-between" />
          </label>
          <label className={smallLabel}>
            {tt("f_lang")}
            <select className={smallInput} value={quote.lang} onChange={(e) => setHeader({ lang: e.currentTarget.value === "en" ? "en" : "es" })}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </header>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={(["edit", "client"] as const).map((v) => ({ value: v, label: v === "edit" ? tt("tab_edit") : tt("tab_client") }))}
        end={
          canEditCosts && (
            <Link href="/cotizacion/costos" className="text-xs text-muted-foreground hover:text-foreground">
              {tt("costs_link")}
            </Link>
          )
        }
      />

      {tab === "client" ? (
        <ClientView quote={quote} onDetail={(pdfDetail) => setHeader({ pdfDetail })} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Zona de cotización: un tono muy tenue del color del tema la separa
              del encabezado (cliente, fechas), para que se vea dónde se está
              cotizando. Las tarjetas de adentro siguen en blanco. */}
          <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_5%,var(--background))] p-2.5 sm:p-3.5">
            {/* Ítems de la cotización: ubicación chica arriba, ítem grande */}
            <div className="flex flex-wrap gap-1.5">
              {quote.sections.map((s) =>
                confirmDelete === s.id ? (
                  <div key={s.id} className="flex flex-col justify-center gap-1.5 rounded-lg border border-destructive bg-[color-mix(in_srgb,var(--status-error)_8%,white)] px-2.5 py-2 text-xs">
                    <span>
                      {tt("sec_delete_confirm")} <b>{s.name || tt("sec_unnamed")}</b>?
                    </span>
                    <span className="flex gap-1.5">
                      <button type="button" onClick={() => removeSection(s.id)} className="rounded-md border border-destructive bg-card px-2 py-0.5 font-medium text-destructive">
                        {tt("delete")}
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-md border border-input bg-card px-2 py-0.5 font-medium">
                        {tt("cancel")}
                      </button>
                    </span>
                  </div>
                ) : (
                  <div key={s.id} className="group relative flex">
                    <button
                      type="button"
                      aria-pressed={section?.id === s.id}
                      onClick={() => {
                        setCurrentId(s.id);
                        setConfirmDelete(null);
                      }}
                      className={cn(
                        "grid min-w-[128px] rounded-lg border py-2 pr-8 pl-3 text-left",
                        section?.id === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-ink-700"
                      )}
                    >
                      <span className={cn("text-[10px] tracking-[0.1em] uppercase", section?.id === s.id ? "text-stone-400" : "text-muted-foreground")}>
                        {s.location || tt("sec_no_location")}
                      </span>
                      <span className="text-base leading-tight font-semibold">{s.name || tt("sec_unnamed")}</span>
                      <span className={cn("mt-0.5 text-[11px] tabular-nums", section?.id === s.id ? "text-cream-100/80" : "text-muted-foreground")}>
                        {formatMoney(sectionTotals(s).total)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${tt("delete")} ${s.name}`}
                      title={tt("delete")}
                      onClick={() => setConfirmDelete(s.id)}
                      className={cn(
                        "absolute top-1 right-1 flex size-5 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
                        section?.id === s.id ? "text-cream-100/70 hover:bg-cream-100/15 hover:text-cream-100" : "text-muted-foreground hover:bg-muted hover:text-destructive"
                      )}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              )}
              <button type="button" onClick={addSection} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-900/25 px-3 text-xs font-medium text-ink-700 hover:border-ink-700">
                <Plus className="size-3.5" />
                {tt("sec_add")}
              </button>
            </div>

            {section ? (
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-card p-3.5 shadow-sm">
                <SectionEditor
                  key={section.id}
                  section={section}
                  catalog={catalog}
                  canEditCosts={canEditCosts}
                  open={open}
                  onToggle={(k) => setOpen((o) => ({ ...o, [k]: !o[k] }))}
                  onChange={setSection}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{tt("sec_empty")}</div>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
            {section && (
              <Viewer3D
                section={section}
                onMoveLine={(lineId, wall, x, y) =>
                  patchSection(section.id, (s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, wall, posX: x, posY: y } : l)) }))
                }
                onHostLine={(lineId, hostLineId) =>
                  patchSection(section.id, (s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, hostLineId } : l)) }))
                }
                onShape={(wallShape, cornerAt) => patchSection(section.id, (s) => ({ ...s, wallShape, cornerAt }))}
                onReset={() =>
                  patchSection(section.id, (s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, wall: null, posX: null, posY: null, hostLineId: null })) }))
                }
              />
            )}

            {section && secTotals && (
              <div className="rounded-lg overflow-hidden border border-border bg-card">
                <h2 className={cn(panelTitle, "border-b border-border px-3.5 py-2.5")}>{tt("breakdown_title")}</h2>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 p-3.5 text-sm">
                  <dt className="text-ink-700">{tt("block_ebony")}</dt>
                  <dd className={money}>{formatMoney(secTotals.ebony)}</dd>
                  <dt className="pl-3 text-[11px] text-muted-foreground">
                    {tt("bk_util")} {section.utilPct}%
                  </dt>
                  <dd className={cn(money, "text-[11px] text-muted-foreground")}>+{formatMoney(secTotals.util)}</dd>
                  <dt className="text-ink-700">{tt("block_subs")}</dt>
                  <dd className={money}>{formatMoney(secTotals.sub)}</dd>
                  {secTotals.sub > 0 && (
                    <>
                      <dt className="pl-3 text-[11px] text-muted-foreground">
                        {tt("bk_margin")} {section.subMarginPct}%
                      </dt>
                      <dd className={cn(money, "text-[11px] text-muted-foreground")}>+{formatMoney(secTotals.subTotal - secTotals.sub)}</dd>
                    </>
                  )}
                  <dt className="text-ink-700">{tt("block_extras")}</dt>
                  <dd className={money}>{formatMoney(secTotals.extras)}</dd>
                  {secTotals.commission > 0 && (
                    <>
                      <dt className="pl-3 text-[11px] text-muted-foreground">
                        {tt("bk_commission")} {section.commissionPct}%
                      </dt>
                      <dd className={cn(money, "text-[11px] text-muted-foreground")}>+{formatMoney(secTotals.commission)}</dd>
                    </>
                  )}
                  <dt className="pl-3 text-[11px] text-muted-foreground">
                    {tt("bk_ccf")} {section.ccfPct}%
                  </dt>
                  <dd className={cn(money, "text-[11px] text-muted-foreground")}>+{formatMoney(secTotals.ccf)}</dd>
                  <dt className="mt-1.5 border-t border-border pt-2">{nameCell(section)}</dt>
                  <dd className={cn(money, "mt-1.5 border-t border-border pt-2 text-base font-bold")}>{formatMoney(secTotals.total)}</dd>
                </dl>
              </div>
            )}

            <div className="rounded-lg overflow-hidden border border-border bg-card">
              <h2 className={cn(panelTitle, "border-b border-border px-3.5 py-2.5")}>{tt("total_title")}</h2>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 p-3.5 text-sm">
                {quote.sections.map((s) => (
                  <React.Fragment key={s.id}>
                    <dt className="min-w-0">{nameCell(s)}</dt>
                    <dd className={money}>{formatMoney(sectionTotals(s).total)}</dd>
                  </React.Fragment>
                ))}
                <dt className="mt-1 border-t border-border pt-2 text-ink-700">{tt("subtotal")}</dt>
                <dd className={cn(money, "mt-1 border-t border-border pt-2")}>{formatMoney(totals.subtotal)}</dd>
                <dt className="flex items-center gap-2 text-ink-700">
                  {tt("discount")}
                  <span className="inline-flex h-7 items-center rounded-md border border-input bg-card pr-0.5 pl-1.5 focus-within:border-ring">
                    <NumField value={quote.discountValue} onChange={(n) => setHeader({ discountValue: n })} locked={false} inputWidth={46} className="h-auto border-0 px-0 focus-within:ring-0" aria-label={tt("discount")} />
                    <button
                      type="button"
                      title={tt("discount_toggle")}
                      onClick={() => setHeader({ discountType: quote.discountType === "pct" ? "amount" : "pct" })}
                      className="ml-1 bg-muted px-1.5 text-[11px] leading-[20px] text-ink-700 hover:bg-accent"
                    >
                      {quote.discountType === "pct" ? "%" : "$"}
                    </button>
                  </span>
                </dt>
                <dd className={money}>{totals.discount > 0 ? `−${formatMoney(totals.discount)}` : "—"}</dd>
                <dt className="text-[11px] text-muted-foreground">ITBMS {quote.itbmsPct}%</dt>
                <dd className={cn(money, "text-[11px] text-muted-foreground")}>{formatMoney(totals.tax)}</dd>
                <dt className="mt-1 border-t border-border pt-2 font-semibold">{tt("total")}</dt>
                <dd className={cn(money, "mt-1 border-t border-border pt-2 text-lg font-bold")}>{formatMoney(totals.total)}</dd>
              </dl>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
