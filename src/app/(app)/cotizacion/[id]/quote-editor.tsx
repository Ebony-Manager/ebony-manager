"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, Copy, Download, Loader2, Lock, Pencil, Send, TriangleAlert, Undo2, Waypoints, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import {
  formatMoney,
  newSection,
  quoteTotals,
  sectionTotals,
  syncDraftPrices,
} from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  isQuoteLocked,
  type CatalogItem,
  type Quote,
  type QuoteDefaults,
  type QuoteOwnerOptions,
  type QuoteSection,
  type QuoteSibling,
  type QuoteStatus,
  type QuoteStatusResult,
  type QuoteImage,
} from "@/types/cotizador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { projectPath } from "../../proyectos/paths";
import { QUOTE_STATUS_STYLE } from "../status-style";
import {
  ApproveQuoteDialog,
  RejectQuoteDialog,
  type ApproveChoice,
} from "./status-dialogs";
import type { Client } from "@/types/ventas";
import { quoteWho, validUntil } from "@/lib/cotizador/owner";
import { Textarea } from "@/components/ui/textarea";
import { OwnerPanel } from "./owner-panel";
import { ItemImages } from "./item-images";
import { usePageTitle } from "@/components/shared/page-title";
import { downloadQuotePdf } from "./quote-pdf";
import { ItemsPanel, ItemTabs, type ItemsNavProps } from "./items-nav";
import { duplicateSection, locationGroups, locationSuggestions, moveSection, shiftSection } from "@/lib/cotizador/items";
import {
  createQuoteAction,
  duplicateQuoteAction,
  saveQuoteAction,
  setQuoteStatusAction,
} from "../actions";
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
  clients,
  owners,
  siblings = [],
  isAdmin = false,
  initialImages = [],
}: {
  /** Imágenes de referencia de los ítems. */
  initialImages?: QuoteImage[];
  initialQuote: Quote;
  isNew?: boolean;
  catalog: CatalogItem[];
  defaults: QuoteDefaults;
  canEditCosts: boolean;
  clients: Client[];
  owners: QuoteOwnerOptions;
  /** Sus otras versiones y las otras cotizaciones de la misma oportunidad. */
  siblings?: QuoteSibling[];
  isAdmin?: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) =>
    t(lang, strings.cotizador[k]);
  const router = useRouter();

  const [quote, setQuote] = React.useState(() =>
    syncDraftPrices(initialQuote, catalog),
  );
  const [currentId, setCurrentId] = React.useState<string | null>(
    initialQuote.sections[0]?.id ?? null,
  );
  const [tab, setTab] = React.useState<"edit" | "client">("edit");
  const [open, setOpen] = React.useState<Record<BlockKey, boolean>>({
    eb: true,
    sb: true,
    ex: false,
    mg: false,
  });
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [duplicating, setDuplicating] = React.useState(false);
  const [isPersisted, setIsPersisted] = React.useState(!isNew);

  const latest = React.useRef(quote);
  const timer = React.useRef<number | null>(null);
  const inFlight = React.useRef(false);
  const queued = React.useRef(false);
  const persisted = React.useRef(!isNew);
  const creating = React.useRef<Promise<void> | null>(null);
  /** updated_at de lo último que guardamos: si en la base hay otro, alguien más guardó. */
  const expected = React.useRef<string | null>(initialQuote.updatedAt);
  const [conflict, setConflict] = React.useState(false);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [images, setImages] = React.useState<QuoteImage[]>(initialImages);
  /** La función que toma la vista 3D como imagen (la pone el visor). */
  const captureRef = React.useRef<(() => string | null) | null>(null);
  const [statusDialog, setStatusDialog] = React.useState<
    "approve" | "reject" | null
  >(null);
  const [statusBusy, setStatusBusy] = React.useState(false);

  // El primer guardado de una cotización nueva la crea y deja la dirección
  // en /cotizacion/<id> (sin recargar); los siguientes la actualizan. Si se
  // pide guardar mientras se está creando (ej. al salir de la pantalla), se
  // espera a que termine para no crearla dos veces. Al salir no se toca la
  // dirección: ya es la de otra página.
  async function persist(q: Quote, { updateUrl = true } = {}) {
    if (!persisted.current && creating.current)
      await creating.current.catch(() => {});
    if (persisted.current) {
      const res = await saveQuoteAction(q, expected.current);
      if (!res.ok) {
        if (res.conflict) setConflict(true);
        throw new Error(res.conflict ? tt("conflict") : res.error);
      }
      expected.current = res.data;
      return;
    }
    creating.current = (async () => {
      const res = await createQuoteAction(q);
      if (!res.ok) throw new Error(res.error);
      expected.current = res.data.updatedAt;
      // El número lo pone la base (COT-2640…): se muestra sin volver a guardar.
      latest.current = { ...latest.current, number: res.data.number };
      setQuote((cur) => ({ ...cur, number: res.data.number }));
    })();
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

  // Bloqueada (enviada, aprobada o rechazada) no se edita; solo el detalle
  // de la vista para el cliente (`whenLocked`).
  function change(fn: (q: Quote) => Quote, { whenLocked = false } = {}) {
    if (conflict) return;
    if (isQuoteLocked(latest.current) && !whenLocked) return;
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
        const q = latest.current;
        const pendingCreate = creating.current;
        // Solo refs: si se está creando, se espera; luego se crea o se guarda.
        void (async () => {
          if (!persisted.current && pendingCreate)
            await pendingCreate.catch(() => {});
          if (persisted.current) await saveQuoteAction(q, expected.current);
          else await createQuoteAction(q);
        })().catch(() => {});
      }
    };
  }, []);
  React.useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const section =
    quote.sections.find((s) => s.id === currentId) ?? quote.sections[0] ?? null;
  const totals = quoteTotals(quote);
  const secTotals = section ? sectionTotals(section) : null;
  const locked = isQuoteLocked(quote);
  // Nombre de la pestaña: "COT-2640 Teo Zebede · Cotización" (● mientras guarda).
  usePageTitle(
    [
      [quote.number, quoteWho(quote)].filter(Boolean).join(" ") || t(lang, strings.titles.new_quote),
      t(lang, strings.titles.quote),
    ],
    isPersisted && saveState !== "saved",
  );

  const setHeader = (p: Partial<Quote>) => change((q) => ({ ...q, ...p }));
  const setSection = (next: QuoteSection) =>
    change((q) => ({
      ...q,
      sections: q.sections.map((s) => (s.id === next.id ? next : s)),
    }));
  const patchSection = (id: string, fn: (s: QuoteSection) => QuoteSection) =>
    change((q) => ({
      ...q,
      sections: q.sections.map((s) => (s.id === id ? fn(s) : s)),
    }));

  const addSection = () => {
    const id = crypto.randomUUID();
    change((q) => ({
      ...q,
      sections: [
        ...q.sections,
        newSection(id, defaults, section?.location ?? ""),
      ],
    }));
    setCurrentId(id);
  };
  const removeSection = (id: string) => {
    const idx = quote.sections.findIndex((s) => s.id === id);
    const rest = quote.sections.filter((s) => s.id !== id);
    change((q) => ({ ...q, sections: q.sections.filter((s) => s.id !== id) }));
    if (currentId === id) setCurrentId(rest[Math.max(0, idx - 1)]?.id ?? null);
  };

  // La vista 3D se puede plegar; se recuerda en este navegador.
  const [viewerOpen, setViewerOpen] = React.useState(true);
  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador.
      if (window.localStorage.getItem("cotizador.viewer") === "0") setViewerOpen(false);
    } catch {}
  }, []);
  const toggleViewer = () => {
    setViewerOpen((v) => {
      try {
        window.localStorage.setItem("cotizador.viewer", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  const navProps: ItemsNavProps = {
    sections: quote.sections,
    currentId: section?.id ?? null,
    onSelect: (id) => setCurrentId(id),
    locked,
    onAdd: addSection,
    onDuplicate: (id) => {
      let copyId: string | null = null;
      change((q) => {
        const r = duplicateSection(q.sections, id, () => crypto.randomUUID());
        copyId = r.copyId;
        return { ...q, sections: r.sections };
      });
      if (copyId) setCurrentId(copyId);
    },
    onRemove: removeSection,
    onShift: (id, delta) => change((q) => ({ ...q, sections: shiftSection(q.sections, id, delta) })),
    onMove: (id, beforeId) => change((q) => ({ ...q, sections: moveSection(q.sections, id, beforeId) })),
  };

  /** El ítem tiene que existir en la base antes de colgarle una imagen: se guarda ya. */
  async function ensureSaved() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    await flush();
    while (inFlight.current) await new Promise((r) => window.setTimeout(r, 100));
    if (!persisted.current) throw new Error(tt("save_error"));
  }

  /** Antes de cambiar el estado, lo que falte por guardar se guarda. */
  async function settle() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      void flush();
    }
    while (inFlight.current)
      await new Promise((r) => window.setTimeout(r, 100));
  }

  function applyStatus(res: QuoteStatusResult) {
    const patch = {
      status: res.status,
      sentOn: res.sentOn,
      closedOn: res.closedOn,
      followUpOn: res.followUpOn,
      projectId: res.projectId,
    };
    latest.current = { ...latest.current, ...patch };
    setQuote((cur) => ({ ...cur, ...patch }));
    expected.current = res.updatedAt;
  }

  async function runStatus(
    status: QuoteStatus,
    input: Parameters<typeof setQuoteStatusAction>[2] = {},
  ) {
    setStatusBusy(true);
    try {
      await settle();
      const res = await setQuoteStatusAction(
        quote.id,
        status,
        input,
        quote.opportunityId,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      applyStatus(res.data);
      setStatusDialog(null);
      const projectId = res.data.projectId;
      if (status === "APROBADA" && quote.opportunityId && projectId) {
        toast.success(
          () => (
            <span className="flex items-center gap-2">
              {tt("st_changed")}
              <Link
                href={projectPath(projectId)}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                {tt("open_project")}
              </Link>
            </span>
          ),
          { duration: 6000 },
        );
      } else toast.success(tt("st_changed"));
      router.refresh();
    } finally {
      setStatusBusy(false);
    }
  }

  function onSend() {
    if (!quoteWho(quote)) return void toast.error(tt("st_need_owner"));
    void runStatus("ENVIADA");
  }

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
      toast.success(tt("version_created"));
      router.push(`/cotizacion/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDuplicating(false);
    }
  }

  const statusLabel = (s: QuoteStatus) => tt(`status_${s}`);
  const canStatus = isPersisted && !statusBusy && !conflict;
  const shortDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(
      lang === "en" ? "en-US" : "es-PA",
      { day: "numeric", month: "short" },
    );
  const smallLabel =
    "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground/80";
  const panelTitle =
    "text-[11px] font-semibold tracking-[0.08em] text-primary uppercase";
  const money = "text-right tabular-nums";

  const nameCell = (s: Pick<QuoteSection, "location" | "name">) => (
    <span className="flex min-w-0 items-baseline gap-1.5">
      {s.location && (
        <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
          {s.location}
        </span>
      )}
      <span className="truncate font-semibold text-foreground">
        {s.name || tt("sec_unnamed")}
      </span>
    </span>
  );

  return (
    <div className={PAGE_CLASS}>
      {/* Encabezado: el cliente es lo que más se ve */}
      {conflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            {tt("conflict")}
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-destructive/40 bg-card px-2.5 py-1 text-xs font-medium"
          >
            {tt("reload")}
          </button>
        </div>
      )}
      <header className="flex flex-col gap-3">
        {/* Arriba: volver, si se guardó y un solo menú de acciones. */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1">
            <BackLink href="/cotizacion" label={tt("title")} />
            {quote.opportunityId && (
              <Link
                href={`/cotizacion/seguimiento?abrir=${quote.opportunityId}`}
                title={tt("from_follow_up")}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Waypoints className="size-3.5" />
                <span className="hidden sm:inline">{tt("from_follow_up")}</span>
              </Link>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-live="polite"
              title={
                saveState === "saved"
                  ? tt(isPersisted ? "save_saved" : "save_new")
                  : saveState === "error"
                    ? tt("save_error")
                    : tt("save_saving")
              }
            >
              {saveState === "saved" && isPersisted && <Check className="size-3.5 text-[var(--status-ok)]" />}
              {(saveState === "saving" || saveState === "pending") && <Loader2 className="size-3.5 animate-spin" />}
              {saveState === "error" && <TriangleAlert className="size-3.5 text-destructive" />}
              <span className={cn(saveState !== "error" && "hidden sm:inline")}>
                {saveState === "saved"
                  ? tt(isPersisted ? "save_saved" : "save_new")
                  : saveState === "error"
                    ? tt("save_error")
                    : tt("save_saving")}
              </span>
              {saveState === "error" && (
                <button type="button" onClick={() => void flush()} className="underline">
                  {tt("save_retry")}
                </button>
              )}
            </span>
            {isPersisted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant={quote.status === "BORRADOR" ? "default" : "outline"} disabled={statusBusy || duplicating || conflict}>
                    {statusBusy || duplicating ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    {tt("actions")}
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  {quote.status === "BORRADOR" && (
                    <DropdownMenuItem onSelect={onSend} disabled={!canStatus}>
                      <Send className="size-4" />
                      {tt("st_send")}
                    </DropdownMenuItem>
                  )}
                  {(quote.status === "BORRADOR" || quote.status === "ENVIADA") && (
                    <>
                      <DropdownMenuItem onSelect={() => setStatusDialog("approve")} disabled={!canStatus}>
                        <CheckCircle2 className="size-4 text-[var(--status-ok)]" />
                        {tt("st_approve_action")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setStatusDialog("reject")} disabled={!canStatus}>
                        <XCircle className="size-4 text-destructive" />
                        {tt("st_reject_action")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onSelect={() =>
                      void downloadQuotePdf(latest.current, images).catch((err) => toast.error(err instanceof Error ? err.message : "Error"))
                    }
                  >
                    <Download className="size-4" />
                    {tt("pdf_download")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void onDuplicate()} title={tt("duplicate_version_hint")}>
                    <Copy className="size-4" />
                    {tt("duplicate_version")}
                  </DropdownMenuItem>
                  {quote.status === "ENVIADA" && isAdmin && (
                    <DropdownMenuItem onSelect={() => void runStatus("BORRADOR")} disabled={!canStatus}>
                      <Undo2 className="size-4" />
                      {tt("st_reopen")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground tabular-nums">
            {quote.number || tt("number_pending")}
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] tracking-normal", QUOTE_STATUS_STYLE[quote.status])}>{statusLabel(quote.status)}</span>
          </p>
          <h1 className={cn("truncate text-xl font-semibold", quoteWho(quote) ? "text-foreground" : "text-muted-foreground")}>
            {quoteWho(quote) || tt("own_none")}
          </h1>
          {(quote.projectName || (quote.clientName && quote.designerName)) && (
            <p className="truncate text-sm text-muted-foreground">
              {[quote.projectName, quote.clientName ? quote.designerName : ""].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {(locked || siblings.length > 0) && (
          <div className="flex flex-col gap-2">
            {locked && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
                <Lock className="size-4 shrink-0" />
                {quote.status === "ENVIADA" && quote.sentOn && (
                  <span>
                    {tt("st_sent_on")} {shortDate(quote.sentOn)}
                    {quote.followUpOn &&
                      ` · ${tt("st_follow_up")} ${shortDate(quote.followUpOn)}`}
                    .
                  </span>
                )}
                {quote.status !== "ENVIADA" && quote.closedOn && (
                  <span>
                    {tt("st_closed_on")} {shortDate(quote.closedOn)}.
                  </span>
                )}
                <span>{tt("st_locked")}</span>
                {quote.status === "APROBADA" && quote.projectId && (
                  <Link
                    href={projectPath(quote.projectId)}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {tt("open_project")}
                  </Link>
                )}
              </div>
            )}
            {siblings.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{tt("versions")}:</span>
                <span className="rounded-md border border-primary px-2 py-0.5 font-semibold tabular-nums">
                  {quote.number}
                </span>
                {siblings.map((sib) => (
                  <Link
                    key={sib.id}
                    href={`/cotizacion/${sib.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 tabular-nums hover:border-ring"
                  >
                    {sib.number}
                    <span
                      className={cn(
                        "rounded px-1 text-[10px] font-semibold",
                        QUOTE_STATUS_STYLE[sib.status],
                      )}
                    >
                      {statusLabel(sib.status)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <fieldset
          disabled={locked}
          className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
        >
          <OwnerPanel
            quote={quote}
            clients={clients}
            owners={owners}
            tt={tt}
            onChange={(p) => setHeader(p)}
          />

          {/* Condiciones: una línea de resumen; se abre para cambiarlas. */}
          {termsOpen ? (
            <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3.5 sm:grid-cols-4">
            <label className={smallLabel}>
              {tt("f_date")}
              <Input
                type="date"
                className="block h-9 appearance-none text-left"
                value={quote.quoteDate}
                onChange={(e) =>
                  e.currentTarget.value &&
                  setHeader({ quoteDate: e.currentTarget.value })
                }
              />
            </label>
            <label className={smallLabel}>
              {tt("f_delivery")}
              <NumField
                value={quote.deliveryDays}
                onChange={(n) => setHeader({ deliveryDays: Math.round(n) })}
                suffix={tt("unit_days")}
                inputWidth={40}
                className="h-9 justify-between"
              />
            </label>
            <label className={smallLabel}>
              <span className="flex items-baseline justify-between gap-2">
                {tt("f_valid")}
                <span className="truncate font-normal text-muted-foreground">
                  {tt("valid_until")}{" "}
                  {shortDate(validUntil(quote.quoteDate, quote.validDays))}
                </span>
              </span>
              <NumField
                value={quote.validDays}
                onChange={(n) =>
                  setHeader({ validDays: Math.max(0, Math.round(n)) })
                }
                suffix={tt("unit_cal_days")}
                inputWidth={40}
                className="h-9 justify-between"
              />
            </label>
            <div className={smallLabel}>
              <span>{tt("f_lang")}</span>
              <Select
                value={quote.lang}
                onValueChange={(v) => setHeader({ lang: v === "en" ? "en" : "es" })}
              >
                <SelectTrigger className="w-full" aria-label={tt("f_lang")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
              <button type="button" onClick={() => setTermsOpen(false)} className="self-end text-xs font-medium text-primary hover:underline">
                {tt("own_done")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-sm hover:border-ring"
            >
              <span>
                <span className="text-muted-foreground">{tt("f_date")}</span> {shortDate(quote.quoteDate)}
              </span>
              <span>
                <span className="text-muted-foreground">{tt("f_delivery")}</span> {quote.deliveryDays} {tt("unit_days")}
              </span>
              <span>
                <span className="text-muted-foreground">{tt("valid_until")}</span> {shortDate(validUntil(quote.quoteDate, quote.validDays))}
              </span>
              <span>{quote.lang === "en" ? "English" : "Español"}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Pencil className="size-3.5" />
                {tt("edit")}
              </span>
            </button>
          )}
        </fieldset>
      </header>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={(["edit", "client"] as const).map((v) => ({
          value: v,
          label: v === "edit" ? tt("tab_edit") : tt("tab_client"),
        }))}
        end={
          canEditCosts && (
            <Link
              href="/cotizacion/costos"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {tt("costs_link")}
            </Link>
          )
        }
      />

      {tab === "client" ? (
        <ClientView
          quote={quote}
          images={images}
          onDetail={(pdfDetail) =>
            change((q) => ({ ...q, pdfDetail }), { whenLocked: true })
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Celular: pestañas que se deslizan; "Ver todos" abre la lista. */}
          <div className="lg:hidden">
            <ItemTabs {...navProps} />
          </div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_340px]">
            {/* Computadora: la lista de ítems por ubicación, fija al hacer scroll. */}
            <nav aria-label={tt("items_title")} className="hidden min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-2.5 lg:row-span-2 2xl:row-span-1 lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)]">
              <h2 className={cn(panelTitle, "px-1.5 pt-0.5")}>
                {tt("items_title")} ({quote.sections.length})
              </h2>
              <ItemsPanel {...navProps} />
            </nav>

            <div className="flex min-w-0 flex-col gap-4">
              {section ? (
                <fieldset
                  disabled={locked}
                  className="m-0 min-w-0 rounded-lg border border-border bg-card p-3.5"
                >
                  <SectionEditor
                    key={section.id}
                    section={section}
                    catalog={catalog}
                    canEditCosts={canEditCosts}
                    open={open}
                    onToggle={(k) => setOpen((o) => ({ ...o, [k]: !o[k] }))}
                    onChange={setSection}
                    locations={locationSuggestions(quote.sections)}
                    extra={
                      <ItemImages
                        key={section.id}
                        quoteId={quote.id}
                        sectionId={section.id}
                        images={images.filter((i) => i.sectionId === section.id)}
                        locked={locked}
                        ensureSaved={ensureSaved}
                        capture3d={() => (viewerOpen ? (captureRef.current?.() ?? null) : null)}
                        onChange={(list) => setImages((all) => [...all.filter((i) => i.sectionId !== section.id), ...list])}
                      />
                    }
                  />
                </fieldset>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                  {tt("sec_empty")}
                </div>
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2 2xl:sticky 2xl:top-4 2xl:col-start-3 2xl:row-start-1">
              {/* Vista 3D plegable: cerrada, una barra; abierta, "Ocultar" encima. */}
              {section &&
                (viewerOpen ? (
                  <button type="button" onClick={toggleViewer} aria-expanded className="-mb-2.5 flex items-center gap-1 self-end text-xs text-muted-foreground hover:text-foreground">
                    {tt("viewer_hide_full")}
                    <ChevronDown className="size-3.5 rotate-180" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleViewer}
                    aria-expanded={false}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left hover:border-ring"
                  >
                    <span className={panelTitle}>{tt("viewer_toggle")}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {tt("viewer_show")}
                      <ChevronDown className="size-3.5" />
                    </span>
                  </button>
                ))}
            {section && viewerOpen && (
              <Viewer3D
                captureRef={captureRef}
                section={section}
                onMoveLine={(lineId, wall, x, y) =>
                  patchSection(section.id, (s) => ({
                    ...s,
                    lines: s.lines.map((l) =>
                      l.id === lineId ? { ...l, wall, posX: x, posY: y } : l,
                    ),
                  }))
                }
                onHostLine={(lineId, hostLineId) =>
                  patchSection(section.id, (s) => ({
                    ...s,
                    lines: s.lines.map((l) =>
                      l.id === lineId ? { ...l, hostLineId } : l,
                    ),
                  }))
                }
                onShape={(wallShape, cornerAt) =>
                  patchSection(section.id, (s) => ({
                    ...s,
                    wallShape,
                    cornerAt,
                  }))
                }
                onReset={() =>
                  patchSection(section.id, (s) => ({
                    ...s,
                    lines: s.lines.map((l) => ({
                      ...l,
                      wall: null,
                      posX: null,
                      posY: null,
                      hostLineId: null,
                    })),
                  }))
                }
              />
            )}

            {section && secTotals && (
              <div className="rounded-lg overflow-hidden border border-border bg-card">
                <h2
                  className={cn(
                    panelTitle,
                    "border-b border-border px-3.5 py-2.5",
                  )}
                >
                  {tt("breakdown_title")}
                </h2>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 p-3.5 text-sm">
                  <dt className="text-foreground/80">{tt("block_ebony")}</dt>
                  <dd className={money}>{formatMoney(secTotals.ebony)}</dd>
                  <dt className="pl-3 text-[11px] text-muted-foreground">
                    {tt("bk_util")} {section.utilPct}%
                  </dt>
                  <dd
                    className={cn(money, "text-[11px] text-muted-foreground")}
                  >
                    +{formatMoney(secTotals.util)}
                  </dd>
                  <dt className="text-foreground/80">{tt("block_subs")}</dt>
                  <dd className={money}>{formatMoney(secTotals.sub)}</dd>
                  {secTotals.sub > 0 && (
                    <>
                      <dt className="pl-3 text-[11px] text-muted-foreground">
                        {tt("bk_margin")} {section.subMarginPct}%
                      </dt>
                      <dd
                        className={cn(
                          money,
                          "text-[11px] text-muted-foreground",
                        )}
                      >
                        +{formatMoney(secTotals.subTotal - secTotals.sub)}
                      </dd>
                    </>
                  )}
                  <dt className="text-foreground/80">{tt("block_extras")}</dt>
                  <dd className={money}>{formatMoney(secTotals.extras)}</dd>
                  {secTotals.commission > 0 && (
                    <>
                      <dt className="pl-3 text-[11px] text-muted-foreground">
                        {tt("bk_commission")} {section.commissionPct}%
                      </dt>
                      <dd
                        className={cn(
                          money,
                          "text-[11px] text-muted-foreground",
                        )}
                      >
                        +{formatMoney(secTotals.commission)}
                      </dd>
                    </>
                  )}
                  <dt className="pl-3 text-[11px] text-muted-foreground">
                    {tt("bk_ccf")} {section.ccfPct}%
                  </dt>
                  <dd
                    className={cn(money, "text-[11px] text-muted-foreground")}
                  >
                    +{formatMoney(secTotals.ccf)}
                  </dd>
                  {secTotals.qty > 1 && (
                    <>
                      <dt className="mt-1.5 border-t border-border pt-2 text-foreground/80">
                        {tt("per_unit")}
                      </dt>
                      <dd className={cn(money, "mt-1.5 border-t border-border pt-2")}>
                        {formatMoney(secTotals.unit)}
                      </dd>
                      <dt className="text-foreground/80">{tt("sec_qty")}</dt>
                      <dd className={money}>× {secTotals.qty}</dd>
                    </>
                  )}
                  <dt className="mt-1.5 border-t border-border pt-2">
                    {nameCell(section)}
                  </dt>
                  <dd
                    className={cn(
                      money,
                      "mt-1.5 border-t border-border pt-2 text-base font-bold",
                    )}
                  >
                    {formatMoney(secTotals.total)}
                  </dd>
                </dl>
              </div>
            )}


              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <h2 className={cn(panelTitle, "border-b border-border px-3.5 py-2.5")}>
                  {tt("total_title")}
                </h2>
                <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
                  <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 p-3.5 text-sm">
                    {/* Por ubicación (el detalle de cada ítem está en la lista). */}
                    {locationGroups(quote.sections).map((g) => (
                      <React.Fragment key={g.key}>
                        <dt className="min-w-0 truncate text-foreground/80">
                          {g.label || tt("sec_no_location")}
                          <span className="ml-1.5 text-xs text-muted-foreground">({g.sections.length})</span>
                        </dt>
                        <dd className={money}>{formatMoney(g.total)}</dd>
                      </React.Fragment>
                    ))}
                  <dt className="mt-1 border-t border-border pt-2 text-foreground/80">
                    {tt("subtotal")}
                  </dt>
                  <dd className={cn(money, "mt-1 border-t border-border pt-2")}>
                    {formatMoney(totals.subtotal)}
                  </dd>
                  <dt className="flex items-center gap-2 text-foreground/80">
                    {tt("discount")}
                    <span className="inline-flex h-7 items-center rounded-md border border-input bg-card pr-0.5 pl-1.5 focus-within:border-ring">
                      <NumField
                        value={quote.discountValue}
                        onChange={(n) => setHeader({ discountValue: n })}
                        locked={false}
                        inputWidth={46}
                        className="h-auto border-0 px-0 focus-within:ring-0"
                        aria-label={tt("discount")}
                      />
                      <button
                        type="button"
                        title={tt("discount_toggle")}
                        onClick={() =>
                          setHeader({
                            discountType:
                              quote.discountType === "pct" ? "amount" : "pct",
                          })
                        }
                        className="ml-1 bg-muted px-1.5 text-[11px] leading-[20px] text-foreground/80 hover:bg-accent"
                      >
                        {quote.discountType === "pct" ? "%" : "$"}
                      </button>
                    </span>
                  </dt>
                  <dd className={money}>
                    {totals.discount > 0
                      ? `−${formatMoney(totals.discount)}`
                      : "—"}
                  </dd>
                  <dt className="text-[11px] text-muted-foreground">
                    ITBMS {quote.itbmsPct}%
                  </dt>
                  <dd
                    className={cn(money, "text-[11px] text-muted-foreground")}
                  >
                    {formatMoney(totals.tax)}
                  </dd>
                  <dt className="mt-1 border-t border-border pt-2 font-semibold">
                    {tt("total")}
                  </dt>
                  <dd
                    className={cn(
                      money,
                      "mt-1 border-t border-border pt-2 text-lg font-bold",
                    )}
                  >
                    {formatMoney(totals.total)}
                  </dd>
                  </dl>
                </fieldset>
              </div>

            <label className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3.5">
              <span className={panelTitle}>{tt("f_notes")}</span>
              <Textarea
                disabled={locked}
                value={quote.notes}
                onChange={(e) => setHeader({ notes: e.currentTarget.value })}
                placeholder={tt("f_notes_ph")}
                rows={3}
              />
            </label>
            </aside>
          </div>
        </div>
      )}

      <ApproveQuoteDialog
        quote={quote}
        open={statusDialog === "approve"}
        siblings={siblings}
        projects={owners.projects}
        onClose={() => setStatusDialog(null)}
        onConfirm={(c: ApproveChoice) =>
          runStatus("APROBADA", {
            projectName: c.projectName,
            projectId: c.projectId,
            also: c.also,
          })
        }
      />
      <RejectQuoteDialog
        quote={quote}
        open={statusDialog === "reject"}
        siblings={siblings}
        onClose={() => setStatusDialog(null)}
        onConfirm={(lostReason, lostNote) =>
          runStatus("RECHAZADA", { lostReason, lostNote })
        }
      />
    </div>
  );
}
