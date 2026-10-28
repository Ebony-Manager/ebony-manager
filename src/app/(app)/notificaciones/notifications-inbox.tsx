"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import type { AppNotice } from "@/services/notifications";
import { PushControls } from "../settings/notificaciones/push-controls";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

type ReadFilter = "all" | "unread";
const MODULE_NAMES: Record<string, string> = {
  documentos: "Personal",
  asistencia: "Asistencia",
  planilla: "Planilla",
  almacen: "Almacén",
  almacen_ajustes: "Almacén",
  almacen_compras: "Compras",
  inspecciones: "Inspecciones",
};

export function NotificationsInbox({ notices }: { notices: AppNotice[] }) {
  const router = useRouter();
  const [readFilter, setReadFilter] = React.useState<ReadFilter>("all");
  const [module, setModule] = React.useState("all");
  const unread = notices.filter((n) => !n.seenAt).length;
  const modules = [...new Set(notices.map((n) => n.module).filter((x): x is string => Boolean(x)))];
  const visible = notices.filter((n) => (readFilter === "all" || !n.seenAt) && (module === "all" || n.module === module));

  async function markAll() {
    await markAllNotificationsReadAction();
    router.refresh();
  }

  function openNotice(notice: AppNotice) {
    if (!notice.seenAt) void markNotificationReadAction(notice.id);
  }

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        title="Notificaciones"
        subtitle="Avisos de los módulos a los que tienes acceso."
        action={unread ? (
          <Button size="sm" variant="outline" onClick={() => void markAll()}>
            <CheckCheck className="size-3.5" /> Marcar todas como leídas
          </Button>
        ) : undefined}
      />

      <PushControls />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          value={readFilter}
          onChange={setReadFilter}
          options={[{ value: "all", label: "Todas" }, { value: "unread", label: `No leídas${unread ? ` (${unread})` : ""}` }]}
        />
        <div className="flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]">
          {["all", ...modules].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setModule(value)}
              className={`h-8 shrink-0 rounded-full border px-3 text-xs font-medium ${module === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              {value === "all" ? "Todos los módulos" : (MODULE_NAMES[value] ?? value)}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState>{notices.length ? "No hay notificaciones con estos filtros." : "Todavía no tienes notificaciones."}</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {visible.map((notice) => {
            const when = new Date(notice.createdAt);
            const date = when.toLocaleDateString("es-PA", { day: "numeric", month: "short", timeZone: "America/Panama" });
            const time = when.toLocaleTimeString("es-PA", { hour: "numeric", minute: "2-digit", timeZone: "America/Panama" });
            const content = (
              <>
                <span className={`mt-1 size-2 shrink-0 rounded-full ${notice.seenAt ? "bg-transparent" : "bg-primary"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{notice.title}</span>
                    {notice.module && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{MODULE_NAMES[notice.module] ?? notice.module}</span>}
                  </span>
                  {notice.body && <span className="mt-0.5 block text-sm text-foreground/80">{notice.body}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">{[notice.actorName, `${date} · ${time}`].filter(Boolean).join(" · ")}</span>
                </span>
                {notice.href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              </>
            );
            return (
              <li key={notice.id} className={!notice.seenAt ? "bg-primary/[0.04]" : undefined}>
                {notice.href ? (
                  <Link href={notice.href} onClick={() => openNotice(notice)} className="flex items-start gap-3 px-3.5 py-3 hover:bg-muted/40">
                    {content}
                  </Link>
                ) : (
                  <button type="button" onClick={() => openNotice(notice)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-muted/40">{content}</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bell className="size-3.5" />El historial muestra hasta las 200 notificaciones más recientes.</p>
    </div>
  );
}
