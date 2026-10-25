"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpFromLine,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FilePen,
  FileText,
  Folder,
  FolderCheck,
  FolderPlus,
  HandCoins,
  PackageX,
  Receipt,
  Send,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState, PAGE_CLASS, PageHeader, Stepper } from "@/components/shared/page-header";
import { pctChange, type ProjectsMonth, type QuotesMonth, type StockSnapshot } from "@/lib/dashboard/company";
import { formatMoney } from "@/lib/cotizador/pricing";
import { currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CompanyDashboardData {
  year: number;
  month: number;
  /** null = el usuario no ve esa sección. */
  quotes: QuotesMonth | null;
  projects: ProjectsMonth | null;
  personal: {
    totalCents: number;
    /** null en enero (el año anterior no se carga). */
    prevTotalCents: number | null;
    payrollCents: number | null;
    contractorsCents: number | null;
    peoplePaid: number;
    attendance: { days: number; hours: number; cents: number; absentPeople: number; latePeople: number } | null;
    loansReceivableCents: number | null;
    contractorsOwedCents: number | null;
  } | null;
  /** `canCosts` falso (sin Compras ni Costos): ni una tarjeta de dinero. */
  almacen: { stock: StockSnapshot; issues: number; products: number; canCosts: boolean } | null;
}

/** "3 h 20 min", "45 min", "2 h" (igual que el resumen de asistencia). */
function hoursLabel(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (!hh) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
const daysLabel = (d: number, lang: "es" | "en") => `${Number(d.toFixed(2))} ${lang === "en" ? (d === 1 ? "day" : "days") : d === 1 ? "día" : "días"}`;

/** Una sección: título con ícono, enlace a su resumen y sus tarjetas. */
function Section({ icon: Icon, title, href, more, children }: { icon: LucideIcon; title: string; href: string; more: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        <Link href={href} className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          {more}
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

/**
 * Dashboard de empresa: cada sección que el usuario puede ver, con los
 * números del mes en tarjetas (ícono y color: verde lo bueno, rojo lo malo,
 * ámbar lo pendiente) y un enlace a su resumen completo.
 */
export function CompanyDashboardView({ data }: { data: CompanyDashboardData }) {
  const { lang } = useLang();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const td = (k: keyof typeof strings.companyDash, vars?: Record<string, string | number>) => {
    let s = t(lang, strings.companyDash[k]);
    for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
    return s;
  };
  const { year, month, quotes, projects, personal, almacen } = data;
  const now = currentPeriod();
  const atNow = year > now.year || (year === now.year && month >= now.month);
  const more = td("see_more");
  const vsPrev = td("vs_prev");

  const go = (d: -1 | 1) => {
    let y = year;
    let m = month + d;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    startTransition(() => router.push(`/dashboard?mes=${y}-${String(m).padStart(2, "0")}`));
  };

  const trend = (cur: number, prev: number | null, goodWhen: "up" | "down") => {
    const pct = prev == null ? null : pctChange(cur, prev);
    return pct == null ? undefined : { pct, goodWhen, label: vsPrev };
  };
  const nothing = !quotes && !projects && !personal && !almacen;

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={td("title")} subtitle={td("subtitle")} />

      {nothing ? (
        <EmptyState>{td("empty")}</EmptyState>
      ) : (
        <>
          <Stepper
            fill
            label={`${monthLabel(lang, month)} ${year}`}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
            nextDisabled={atNow}
            className="sm:self-start [&>span]:min-w-32"
          />

          <div className={cn("grid grid-cols-1 items-start gap-6 transition-opacity lg:grid-cols-2", pending && "opacity-60")}>
            {/* Dos columnas independientes: una sección alta no deja huecos en la otra. */}
            <div className="flex flex-col gap-6">
              {quotes && (
                <Section icon={FileText} title={td("sec_quotes")} href="/cotizacion" more={more}>
                  <KpiCard
                    icon={FileText}
                    tone="primary"
                    label={td("q_quoted")}
                    value={formatMoney(quotes.total)}
                    sublabel={td("q_count", { n: quotes.count })}
                    trend={trend(quotes.total, quotes.prevTotal, "up")}
                  />
                  <KpiCard
                    icon={CheckCircle2}
                    tone="positive"
                    label={td("q_approved")}
                    value={formatMoney(quotes.approvedTotal)}
                    sublabel={td("q_approved_hint", {
                      n: quotes.approvedCount,
                      pct: quotes.total > 0 ? `${Math.round((quotes.approvedTotal / quotes.total) * 100)}%` : "—",
                    })}
                  />
                  <KpiCard icon={Send} tone="warning" label={td("q_open")} value={formatMoney(quotes.sentTotal)} sublabel={td("q_open_hint", { n: quotes.sentCount })} />
                  <KpiCard icon={FilePen} label={td("q_drafts")} value={quotes.drafts} sublabel={td("q_drafts_hint")} />
                </Section>
              )}
              {projects && (
                <Section icon={Folder} title={td("sec_projects")} href="/proyectos" more={more}>
                  <KpiCard icon={Folder} tone="primary" label={td("p_active")} value={projects.active} />
                  <KpiCard icon={FolderPlus} tone="positive" label={td("p_new")} value={projects.created} />
                  <KpiCard icon={FolderCheck} label={td("p_done")} value={projects.completed} className="col-span-2" />
                </Section>
              )}
            </div>
            <div className="flex flex-col gap-6">
              {personal && (
                <Section icon={Wallet} title={td("sec_personal")} href="/personal" more={more}>
                  <KpiCard
                    icon={Wallet}
                    tone="primary"
                    label={td("h_paid")}
                    value={formatCents(personal.totalCents)}
                    sublabel={
                      personal.payrollCents != null && personal.contractorsCents != null
                        ? td("h_paid_split", { a: formatCents(personal.payrollCents), b: formatCents(personal.contractorsCents) })
                        : td("h_people", { n: personal.peoplePaid })
                    }
                    trend={trend(personal.totalCents, personal.prevTotalCents, "down")}
                  />
                  {personal.attendance && (
                    <>
                      <KpiCard
                        icon={CalendarX2}
                        tone="negative"
                        label={td("h_absences")}
                        value={daysLabel(personal.attendance.days, lang)}
                        sublabel={td("h_people", { n: personal.attendance.absentPeople })}
                      />
                      <KpiCard
                        icon={Clock}
                        tone="warning"
                        label={td("h_lateness")}
                        value={hoursLabel(personal.attendance.hours)}
                        sublabel={td("h_docked", { x: formatCents(personal.attendance.cents) })}
                      />
                    </>
                  )}
                  {personal.loansReceivableCents != null && (
                    <KpiCard icon={HandCoins} tone="warning" label={td("h_loans")} value={formatCents(personal.loansReceivableCents)} sublabel={td("h_loans_hint")} />
                  )}
                  {personal.contractorsOwedCents != null && (
                    <KpiCard
                      icon={Receipt}
                      tone="warning"
                      label={td("h_owed")}
                      value={formatCents(personal.contractorsOwedCents)}
                      sublabel={td("h_owed_hint")}
                      className={personal.attendance && personal.loansReceivableCents != null ? "col-span-2" : undefined}
                    />
                  )}
                </Section>
              )}
              {almacen && (
                <Section icon={Warehouse} title={td("sec_almacen")} href="/almacen/resumen" more={more}>
                  {almacen.canCosts ? (
                    <KpiCard
                      icon={Warehouse}
                      tone="primary"
                      label={td("a_value")}
                      value={almacen.stock.valueCents == null ? "—" : formatCents(almacen.stock.valueCents)}
                      sublabel={td("a_value_hint")}
                    />
                  ) : (
                    <KpiCard icon={Warehouse} tone="primary" label={td("a_products_label")} value={almacen.stock.variants} />
                  )}
                  <KpiCard
                    icon={ArrowUpFromLine}
                    label={td("a_issues")}
                    value={almacen.issues}
                    sublabel={td("a_issues_hint", { n: almacen.products })}
                  />
                  <KpiCard icon={PackageX} tone="negative" label={td("a_out")} value={almacen.stock.out} />
                  <KpiCard icon={AlertTriangle} tone="warning" label={td("a_low")} value={almacen.stock.low} />
                </Section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
