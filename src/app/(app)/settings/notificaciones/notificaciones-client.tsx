"use client";

import * as React from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Bell, ChevronRight, Eye, Send } from "lucide-react";

import type { AppUser } from "@/types/usuarios";
import type { AppNotice, NotificationSetting } from "@/services/notifications";
import { Button } from "@/components/ui/button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { markNoticesSeenAction, saveNotificationSettingAction } from "./actions";
import { PushControls } from "./push-controls";
import { EmptyState, PAGE_CLASS, PageHeader, SectionHeader } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Qué hay de cada aviso: título, descripción y dónde se prueba. */
const CATALOG: Record<string, { title: keyof typeof strings.notificaciones; desc: keyof typeof strings.notificaciones; route: string }> = {
  almacen_resumen: { title: "almacen_title", desc: "almacen_desc", route: "/api/almacen/resumen-diario" },
};

/**
 * Settings → Notificaciones: cada aviso automático se prende o apaga, se
 * eligen los días y quién lo recibe ("automático" = admins y quien tiene
 * Compras). Se puede ver un ejemplo y mandar una prueba.
 */
export function NotificacionesClient({ settings, users, notices }: { settings: NotificationSetting[]; users: AppUser[]; notices: AppNotice[] }) {
  const { lang } = useLang();
  const tn = (k: keyof typeof strings.notificaciones) => t(lang, strings.notificaciones[k]);
  const anyUnseen = notices.some((n) => !n.seenAt);

  // Al abrir la página, los avisos quedan vistos (se apaga el número rojo del menú).
  React.useEffect(() => {
    if (anyUnseen) void markNoticesSeenAction().catch(() => undefined);
  }, [anyUnseen]);

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={tn("title")} subtitle={tn("subtitle")} />

      <PushControls />

      <section className="flex flex-col gap-2">
        <SectionHeader title={tn("notices_title")} subtitle={tn("notices_hint")} />
        {notices.length === 0 ? (
          <EmptyState>{tn("notices_empty")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {notices.map((n) => {
              const when = new Date(n.createdAt);
              const time = when.toLocaleTimeString(lang === "en" ? "en-US" : "es-PA", { hour: "numeric", minute: "2-digit", timeZone: "America/Panama" });
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {!n.seenAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={tn("notices_new")} />}
                      {n.title}
                    </span>
                    {n.body && <span className="block text-sm text-foreground/80">{n.body}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {[n.actorName, `${formatDateCompact(lang, todayInPanama(when))} ${time}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {n.href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                </>
              );
              return (
                <li key={n.id} className={!n.seenAt ? "bg-primary/5" : undefined}>
                  {n.href ? (
                    <Link href={n.href} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/40">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3.5 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SectionHeader title={tn("emails_title")} />
      {settings
        .filter((s) => CATALOG[s.key])
        .map((s) => (
          <NotificationCard key={s.key} setting={s} users={users} tn={tn} />
        ))}
    </div>
  );
}

function NotificationCard({
  setting,
  users,
  tn,
}: {
  setting: NotificationSetting;
  users: AppUser[];
  tn: (k: keyof typeof strings.notificaciones) => string;
}) {
  const meta = CATALOG[setting.key];
  const [enabled, setEnabled] = React.useState(setting.enabled);
  const [days, setDays] = React.useState<number[]>(setting.days);
  const [mode, setMode] = React.useState<"auto" | "custom">(setting.recipients ? "custom" : "auto");
  const [picked, setPicked] = React.useState<string[]>(setting.recipients ?? []);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const autoEmails = users.filter((u) => u.role === "admin" || u.modules.includes("almacen_compras")).map((u) => u.email);
  const dirty =
    enabled !== setting.enabled ||
    days.join() !== setting.days.join() ||
    (mode === "auto" ? setting.recipients !== null : [...picked].sort().join() !== [...(setting.recipients ?? [])].sort().join() || setting.recipients === null);

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  const togglePerson = (email: string) => setPicked((ps) => (ps.includes(email) ? ps.filter((x) => x !== email) : [...ps, email]));

  async function save() {
    if (mode === "custom" && picked.length === 0) return toast.error(tn("pick_someone"));
    setSaving(true);
    const res = await saveNotificationSettingAction(setting.key, { enabled, days, recipients: mode === "auto" ? null : picked });
    setSaving(false);
    if (res.ok) toast.success(tn("saved"));
    else toast.error(res.error);
  }

  async function sendTest() {
    setSending(true);
    try {
      const res = await fetch(`${meta.route}?enviar=1`);
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { enviado?: boolean; motivo?: string };
      if (body.enviado) toast.success(tn("test_sent"));
      else toast(body.motivo ?? tn("test_not_sent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { duration: 8000 });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <Bell className="mt-0.5 size-5 shrink-0 text-walnut" />
          <div>
            <h2 className="font-semibold">{tn(meta.title)}</h2>
            <p className="text-sm text-muted-foreground">{tn(meta.desc)}</p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? tn("on") : tn("off")}
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{tn("days")}</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`h-8 min-w-11 rounded-md border px-2 text-sm ${days.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-muted-foreground"}`}
            >
              {tn(`day_${d}` as keyof typeof strings.notificaciones)}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{tn("time_note")}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">{tn("recipients")}</span>
        <SegmentedFilter
          value={mode}
          onChange={setMode}
          options={[
            { value: "auto", label: tn("recipients_auto") },
            { value: "custom", label: tn("recipients_custom") },
          ]}
        />
        {mode === "auto" ? (
          <p className="text-sm text-muted-foreground">
            {tn("recipients_auto_hint")} {autoEmails.join(", ")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {users.map((u) => (
              <li key={u.email}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.includes(u.email)} onChange={() => togglePerson(u.email)} />
                  <span className="font-medium">{u.fullName || u.email}</span>
                  {u.fullName && <span className="text-muted-foreground">{u.email}</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`${meta.route}?ver=1`} target="_blank" rel="noreferrer">
              <Eye className="size-3.5" />
              {tn("preview")}
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={sendTest} disabled={sending}>
            <Send className="size-3.5" />
            {tn("send_test")}
          </Button>
        </div>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? tn("saving") : tn("save")}
        </Button>
      </div>
    </section>
  );
}
