"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ExternalLink, Loader2, RotateCw } from "lucide-react";

import { AlegraLogo } from "@/components/brand/service-logos";
import { alegraInvoiceUrl } from "@/lib/alegra/invoice";
import { strings, t } from "@/lib/i18n";
import { useLang } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { QuoteAlegra } from "@/types/cotizador";
import { getQuoteAlegraAction, invoiceInAlegraAction } from "../actions";

/**
 * La factura de Alegra de una cotización aprobada: "Ver en Alegra" si ya se
 * creó (borrador), "Creando…" mientras tanto, o el error con "Reintentar".
 * `justApproved`: se acaba de aprobar aquí; la factura se crea en segundo
 * plano, así que se vuelve a mirar en unos segundos.
 */
export function AlegraChip({
  quoteId,
  initial,
  justApproved,
}: {
  quoteId: string;
  initial: QuoteAlegra | null;
  justApproved: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) =>
    t(lang, strings.cotizador[k]);
  const [state, setState] = React.useState<QuoteAlegra | null>(initial);
  const [busy, setBusy] = React.useState(false);
  // Cuándo se abrió (un "creando" de hace más de 2 minutos se quedó a medias: se ofrece reintentar).
  const [loadedAt] = React.useState(() => Date.now());

  // Recién aprobada: mira cada pocos segundos hasta que termine (máx. ~1 minuto).
  React.useEffect(() => {
    if (!justApproved) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop || tries++ > 12) return;
      const res = await getQuoteAlegraAction(quoteId);
      if (stop) return;
      if (res.ok) setState(res.data);
      if (!res.ok || !res.data || res.data.status === "creando")
        setTimeout(tick, 5000);
    };
    const id = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(id);
    };
  }, [justApproved, quoteId]);

  async function create() {
    setBusy(true);
    const res = await invoiceInAlegraAction(quoteId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setState(res.data);
    if (res.data.status === "creada") toast.success(tt("alegra_created"));
    else if (res.data.status === "error")
      toast.error(res.data.error ?? "Error", { duration: 10000 });
  }

  const pill =
    "inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-normal normal-case";
  const logo = <AlegraLogo className="size-3.5" />;

  if (state?.status === "creada" && state.invoiceId) {
    return (
      <a
        href={alegraInvoiceUrl(state.invoiceId)}
        target="_blank"
        rel="noreferrer"
        className={cn(pill, "text-foreground hover:bg-muted")}
        title={state.error ?? tt("alegra_view")}
      >
        {logo}
        {state.invoiceNumber
          ? `${tt("alegra_draft")} ${state.invoiceNumber}`
          : tt("alegra_view")}
        {state.error && <span className="text-[var(--status-warn)]">!</span>}
        <ExternalLink className="size-3 text-muted-foreground" />
      </a>
    );
  }
  if (
    state?.status === "creando" &&
    (justApproved || loadedAt - Date.parse(state.updatedAt) < 2 * 60_000)
  ) {
    return (
      <span className={cn(pill, "text-muted-foreground")}>
        {logo}
        <Loader2 className="size-3 animate-spin" />
        {tt("alegra_creating")}
      </span>
    );
  }
  if (!state && justApproved) {
    return (
      <span className={cn(pill, "text-muted-foreground")}>
        {logo}
        <Loader2 className="size-3 animate-spin" />
        {tt("alegra_creating")}
      </span>
    );
  }
  const failed = state?.status === "error" || state?.status === "creando";
  return (
    <button
      type="button"
      onClick={() => void create()}
      disabled={busy}
      title={failed ? (state?.error ?? undefined) : undefined}
      className={cn(
        pill,
        failed
          ? "text-[var(--status-error)] hover:bg-muted"
          : "text-foreground hover:bg-muted",
      )}
    >
      {logo}
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : failed ? (
        <RotateCw className="size-3" />
      ) : null}
      {failed ? tt("alegra_retry") : tt("alegra_create")}
    </button>
  );
}
