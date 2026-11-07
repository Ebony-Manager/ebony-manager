"use client";

import * as React from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CalendarDays,
  Clock,
  FolderOpen,
  KeyRound,
  Loader2,
  PlugZap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { testDriveAction, testJotformAction } from "./actions";

export interface RunRow {
  key: string;
  last_ok_at: string | null;
  last_detail: string | null;
  last_error_at: string | null;
  last_error: string | null;
}

export interface ConnectionsData {
  runs: Record<string, RunRow>;
  /** Último envío recibido por formulario: registro, dinero, ponchadas. */
  jotform: Record<string, string | null>;
  holidaysPending: number;
  env: { jotform: boolean; drive: boolean; feriados: boolean; cron: boolean };
  /** La tabla del registro todavía no existe (migración pendiente). */
  missingTable: boolean;
}

type Tk = keyof typeof strings.conexiones;
type Health = "ok" | "error" | "missing" | "unknown" | "info";

const HEALTH_STYLE: Record<Health, string> = {
  ok: "bg-[color-mix(in_oklab,var(--status-ok)_16%,var(--card))] text-[var(--status-ok)]",
  error:
    "bg-[color-mix(in_oklab,var(--status-error)_13%,var(--card))] text-[var(--status-error)]",
  missing:
    "bg-[color-mix(in_oklab,var(--status-warn)_18%,var(--card))] text-[var(--status-warn)]",
  unknown: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
};

const DAY = 86_400_000;
/** ¿Lo último que pasó fue un error? */
const failing = (r?: RunRow) =>
  !!r?.last_error_at && (!r.last_ok_at || r.last_error_at > r.last_ok_at);

/**
 * Settings → Conexiones: una tarjeta por servicio externo con qué hace, de
 * qué depende, dónde se configura, cómo le fue la última vez y, si se puede,
 * una prueba que no cambia nada.
 */
export function ConexionesClient({ data }: { data: ConnectionsData }) {
  const { lang } = useLang();
  const tc = (k: Tk) => t(lang, strings.conexiones[k]);
  // La hora de cargar la página (las fechas relativas no cambian mientras se ve).
  const [now] = React.useState(() => Date.now());

  const ago = (iso: string | null | undefined) => {
    if (!iso) return tc("never");
    const ms = now - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    const rtf = new Intl.RelativeTimeFormat(lang === "en" ? "en" : "es", {
      numeric: "auto",
    });
    if (min < 60) return rtf.format(-Math.max(min, 0), "minute");
    if (min < 48 * 60) return rtf.format(-Math.round(min / 60), "hour");
    return rtf.format(-Math.round(ms / DAY), "day");
  };
  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PA", {
      timeZone: "America/Panama",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  const r = data.runs;
  const cronSteps: { key: string; label: Tk }[] = [
    { key: "cron:resumen_almacen", label: "step_resumen" },
    { key: "cron:compras_atrasadas", label: "step_compras" },
    { key: "cron:herramientas_vencidas", label: "step_herramientas" },
    { key: "cron:seguimiento_ventas", label: "step_ventas" },
    { key: "cron:feriados", label: "step_feriados" },
    { key: "cron:push", label: "step_push" },
  ];
  const cronLast = r["cron"]?.last_ok_at;
  const cronHealth: Health = !data.env.cron
    ? "missing"
    : failing(r["cron"]) || cronSteps.some((s) => failing(r[s.key]))
      ? "error"
      : !cronLast
        ? "unknown"
        : now - new Date(cronLast).getTime() > 26 * 3_600_000
          ? "error"
          : "ok";
  // Feriados: lo más reciente entre el cron y "Sincronizar ahora".
  const feriadosRun = [r["feriados"], r["cron:feriados"]]
    .filter(Boolean)
    .sort((a, b) => latest(b!) - latest(a!))[0];
  const jotformHealth: Health = !data.env.jotform
    ? "missing"
    : failing(r["jotform:webhook"]) || failing(r["jotform:api"])
      ? "error"
      : r["jotform:webhook"] || Object.values(data.jotform).some(Boolean)
        ? "ok"
        : "unknown";

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={tc("title")} subtitle={tc("subtitle")} />
      {data.missingTable && (
        <p className="max-w-3xl rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {tc("missing_table")}
        </p>
      )}

      <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          icon={Clock}
          title={tc("cron_title")}
          desc={tc("cron_desc")}
          envVars={["CRON_SECRET"]}
          configured={data.env.cron}
          health={cronHealth}
          tc={tc}
        >
          <Fact
            label={tc("last_run")}
            value={
              cronLast ? `${ago(cronLast)} · ${when(cronLast)}` : tc("never")
            }
          />
          {cronLast &&
            cronHealth === "error" &&
            !failing(r["cron"]) &&
            now - new Date(cronLast).getTime() > 26 * 3_600_000 && (
              <p className="text-xs text-[var(--status-error)]">
                {tc("cron_late")}
              </p>
            )}
          {failing(r["cron"]) && <ErrorLine run={r["cron"]!} when={when} />}
          <ul className="flex flex-col gap-1 border-t border-border pt-2">
            {cronSteps.map((s) => {
              const run = r[s.key];
              const bad = failing(run);
              return (
                <li key={s.key} className="flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground/80">{tc(s.label)}</span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        bad
                          ? "font-semibold text-[var(--status-error)]"
                          : "text-muted-foreground",
                      )}
                    >
                      {bad
                        ? `${tc("failed")} ${ago(run!.last_error_at)}`
                        : run?.last_ok_at
                          ? ago(run.last_ok_at)
                          : "—"}
                    </span>
                  </div>
                  {bad && (
                    <span className="text-[11px] break-words text-[var(--status-error)]">
                      {run!.last_error}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          icon={PlugZap}
          title="Jotform"
          desc={tc("jotform_desc")}
          envVars={["JOTFORM_API_KEY"]}
          configured={data.env.jotform}
          health={jotformHealth}
          tc={tc}
          test={testJotformAction}
        >
          <Fact label={tc("jf_registro")} value={ago(data.jotform.registro)} />
          <Fact label={tc("jf_dinero")} value={ago(data.jotform.dinero)} />
          <Fact
            label={tc("jf_ponchadas")}
            value={ago(data.jotform.ponchadas)}
          />
          {failing(r["jotform:webhook"]) && (
            <ErrorLine run={r["jotform:webhook"]!} when={when} />
          )}
          {failing(r["jotform:api"]) && (
            <ErrorLine run={r["jotform:api"]!} when={when} />
          )}
          <p className="text-xs text-muted-foreground">{tc("jotform_note")}</p>
        </Card>

        <Card
          icon={FolderOpen}
          title="Google Drive"
          desc={tc("drive_desc")}
          envVars={[
            "GOOGLE_SERVICE_ACCOUNT_JSON",
            "GOOGLE_DRIVE_ROOT_FOLDER_ID",
          ]}
          configured={data.env.drive}
          health={
            !data.env.drive
              ? "missing"
              : failing(r["drive"])
                ? "error"
                : r["drive"]?.last_ok_at
                  ? "ok"
                  : "unknown"
          }
          tc={tc}
          test={testDriveAction}
        >
          <Fact label={tc("last_ok")} value={ago(r["drive"]?.last_ok_at)} />
          {failing(r["drive"]) && <ErrorLine run={r["drive"]!} when={when} />}
        </Card>

        <Card
          icon={CalendarDays}
          title="feriados.io"
          desc={tc("feriados_desc")}
          envVars={["FERIADOS_API_KEY"]}
          configured={data.env.feriados}
          health={
            !data.env.feriados
              ? "missing"
              : failing(feriadosRun)
                ? "error"
                : feriadosRun?.last_ok_at
                  ? "ok"
                  : "unknown"
          }
          tc={tc}
        >
          <Fact
            label={tc("last_sync")}
            value={
              feriadosRun?.last_ok_at
                ? `${ago(feriadosRun.last_ok_at)}${feriadosRun.last_detail ? ` · ${feriadosRun.last_detail}` : ""}`
                : tc("never")
            }
          />
          {failing(feriadosRun) && <ErrorLine run={feriadosRun!} when={when} />}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                "text-xs",
                data.holidaysPending > 0
                  ? "font-semibold text-[var(--status-warn)]"
                  : "text-muted-foreground",
              )}
            >
              {data.holidaysPending} {tc("pending")}
            </span>
            <Link
              href="/settings/feriados"
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {tc("go_feriados")}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">{tc("feriados_plan")}</p>
        </Card>

        <Card
          icon={KeyRound}
          title={tc("login_title")}
          desc={tc("login_desc")}
          envVars={[]}
          configured
          health="info"
          tc={tc}
        >
          <p className="text-xs text-muted-foreground">{tc("login_note")}</p>
        </Card>
      </div>
    </div>
  );
}

const latest = (r: RunRow) =>
  Math.max(
    r.last_ok_at ? Date.parse(r.last_ok_at) : 0,
    r.last_error_at ? Date.parse(r.last_error_at) : 0,
  );

function Card({
  icon: Icon,
  title,
  desc,
  envVars,
  configured,
  health,
  tc,
  test,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  envVars: string[];
  configured: boolean;
  health: Health;
  tc: (k: Tk) => string;
  test?: () => Promise<{ ok: boolean; message: string }>;
  children: React.ReactNode;
}) {
  const [testing, setTesting] = React.useState(false);
  async function runTest() {
    if (!test) return;
    setTesting(true);
    try {
      const res = await test();
      if (res.ok) toast.success(res.message, { duration: 6000 });
      else toast.error(res.message, { duration: 10000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setTesting(false);
    }
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-walnut" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{title}</h2>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                HEALTH_STYLE[health],
              )}
            >
              {tc(`h_${health}`)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">{children}</div>
      {(envVars.length > 0 || test) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="flex flex-wrap gap-1.5">
            {envVars.map((v) => (
              <code
                key={v}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px]",
                  configured
                    ? "bg-muted text-muted-foreground"
                    : HEALTH_STYLE.missing,
                )}
              >
                {v}
              </code>
            ))}
            {envVars.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {configured ? tc("in_vercel") : tc("missing_in_vercel")}
              </span>
            )}
          </span>
          {test && (
            <Button
              size="sm"
              variant="outline"
              disabled={testing || !configured}
              onClick={() => void runTest()}
            >
              {testing && <Loader2 className="size-3.5 animate-spin" />}
              {tc("test")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground/90">{value}</span>
    </div>
  );
}

function ErrorLine({
  run,
  when,
}: {
  run: RunRow;
  when: (iso: string) => string;
}) {
  return (
    <p className="rounded-md bg-[color-mix(in_oklab,var(--status-error)_10%,var(--card))] px-2.5 py-1.5 text-xs break-words text-[var(--status-error)]">
      {when(run.last_error_at!)} · {run.last_error}
    </p>
  );
}
