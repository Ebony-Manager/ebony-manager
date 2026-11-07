"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Plus, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Holiday, HolidayStatus } from "@/types/holidays";
import {
  addHolidayAction,
  deleteHolidayAction,
  setHolidayStatusAction,
  syncHolidaysAction,
} from "./actions";

type Tk = keyof typeof strings.feriados;

const STATUS_STYLE: Record<HolidayStatus, string> = {
  confirmado:
    "bg-[color-mix(in_oklab,var(--status-ok)_16%,var(--card))] text-[var(--status-ok)]",
  pendiente:
    "bg-[color-mix(in_oklab,var(--status-warn)_18%,var(--card))] text-[var(--status-warn)]",
  descartado: "bg-muted text-muted-foreground",
};

/**
 * Settings → Feriados: lo que trae feriados.io y los días a mano. Solo los
 * confirmados cuentan en asistencia; lo nuevo o cambiado llega por confirmar.
 */
export function FeriadosClient({
  year,
  currentYear,
  holidays,
  hasApiKey,
}: {
  year: number;
  currentYear: number;
  holidays: Holiday[];
  hasApiKey: boolean;
}) {
  const { lang } = useLang();
  const tf = (k: Tk) => t(lang, strings.feriados[k]);
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [date, setDate] = React.useState("");
  const [name, setName] = React.useState("");

  const pending = holidays.filter((h) => h.status === "pendiente").length;
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(
      lang === "en" ? "en-US" : "es-PA",
      opts,
    );

  async function act(
    key: string,
    fn: () => Promise<
      { ok: true; pending?: number } | { ok: false; error: string }
    >,
    okMsg: string,
  ) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error, { duration: 8000 });
      return false;
    }
    toast.success(okMsg);
    router.refresh();
    return true;
  }

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title={tf("title")}
        subtitle={tf("subtitle")}
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={!hasApiKey || busy !== null}
            onClick={() =>
              void act("sync", () => syncHolidaysAction(year), tf("synced"))
            }
          >
            <RefreshCw
              className={cn("size-3.5", busy === "sync" && "animate-spin")}
            />
            {tf("sync")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedFilter
          value={String(year)}
          onChange={(v) => router.push(`/settings/feriados?anio=${v}`)}
          options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({
            value: String(y),
            label: String(y),
          }))}
        />
        {pending > 0 && (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-semibold",
              STATUS_STYLE.pendiente,
            )}
          >
            {pending} {tf("pending_count")}
          </span>
        )}
      </div>

      {!hasApiKey && (
        <p className="max-w-3xl rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {tf("no_key")}
        </p>
      )}
      <p className="max-w-3xl text-sm text-muted-foreground">{tf("rules")}</p>

      <section className="max-w-3xl overflow-hidden rounded-lg border border-border bg-card">
        {holidays.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {tf("empty")}
          </p>
        ) : (
          <ul>
            {holidays.map((h) => (
              <li
                key={h.date}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3.5 py-2.5 last:border-0",
                  h.status === "descartado" && "opacity-60",
                )}
              >
                <div className="w-16 shrink-0 tabular-nums sm:w-24">
                  <p className="text-sm font-semibold">
                    {fmt(h.date, { day: "numeric", month: "short" })}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {fmt(h.date, { weekday: "long" })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      h.source === "feriados_io" ? "feriados.io" : tf("manual"),
                      h.originalDate
                        ? `${tf("moved_from")} ${fmt(h.originalDate, { day: "numeric", month: "short" })}`
                        : null,
                      h.mandatoryRest === false ? tf("not_mandatory") : null,
                      h.missingFromSource ? tf("missing") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1.5 max-sm:basis-full">
                  <span
                    className={cn(
                      "mr-auto rounded-md px-2 py-0.5 text-[11px] font-semibold sm:mr-0",
                      STATUS_STYLE[h.status],
                    )}
                  >
                    {tf(`st_${h.status}`)}
                  </span>
                  {h.status !== "confirmado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(
                          h.date,
                          () => setHolidayStatusAction(h.date, "confirmado"),
                          tf("confirmed"),
                        )
                      }
                    >
                      <Check className="size-3.5" />
                      {tf("confirm")}
                    </Button>
                  )}
                  {h.status !== "descartado" && h.source === "feriados_io" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(
                          h.date,
                          () => setHolidayStatusAction(h.date, "descartado"),
                          tf("discarded"),
                        )
                      }
                    >
                      <X className="size-3.5" />
                      {tf("discard")}
                    </Button>
                  )}
                  {h.source === "manual" && (
                    <ConfirmButton
                      iconOnly
                      label={tf("remove")}
                      confirmLabel={tf("confirm_remove")}
                      disabled={busy !== null}
                      onConfirm={() =>
                        void act(
                          h.date,
                          () => deleteHolidayAction(h.date),
                          tf("removed"),
                        )
                      }
                      className="px-1.5"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex max-w-3xl flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="font-semibold">{tf("add_title")}</h2>
          <p className="text-sm text-muted-foreground">{tf("add_hint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {tf("f_date")}
            </span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </label>
          <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {tf("f_name")}
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tf("f_name_ph")}
            />
          </label>
          <Button
            size="sm"
            className="h-9"
            disabled={!date || !name.trim() || busy !== null}
            onClick={() =>
              void act(
                "add",
                () => addHolidayAction(date, name),
                tf("added"),
              ).then((ok) => {
                if (!ok) return;
                setDate("");
                setName("");
              })
            }
          >
            <Plus className="size-3.5" />
            {tf("add")}
          </Button>
        </div>
      </section>
    </div>
  );
}
