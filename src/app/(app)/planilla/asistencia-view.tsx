"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentPeriod, monthLabel, nextPeriod, previousPeriod, type Period } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getRegistroAction } from "./actions";
import { AttendanceImportDialog } from "./attendance-import-dialog";

type Row = Awaited<ReturnType<typeof getRegistroAction>>[number];

/**
 * Personal → Pagos → Asistencia: el primer paso de la quincena. Se importan
 * el reloj y el Jotform (`AttendanceImportDialog`), se revisa la propuesta
 * y se aplica a la Quincena; abajo, lo que la quincena tiene hoy en horas y
 * días descontados y horas extra. Las ponchadas todavía no se guardan: se
 * leen del archivo cada vez.
 */
export function AsistenciaView({ onApplied }: { onApplied: () => void }) {
  const { lang } = useLang();
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);

  const [period, setPeriod] = React.useState<Period>(() => currentPeriod());
  const [rows, setRows] = React.useState<{ period: Period; data: Row[] } | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(() => {
    const fetchedFor = period;
    startTransition(async () => {
      const data = await getRegistroAction(fetchedFor.year, fetchedFor.month, fetchedFor.half);
      setRows({ period: fetchedFor, data });
    });
  }, [period]);

  React.useEffect(() => {
    load();
  }, [load]);

  const ready = rows && rows.period.year === period.year && rows.period.month === period.month && rows.period.half === period.half;
  const data = ready ? rows.data : [];
  const withHours = data.filter(
    (r) => (r.total.entry?.horasDescontadas ?? 0) > 0 || (r.total.entry?.diasDescontados ?? 0) > 0 || (r.total.entry?.extraHours ?? 0) > 0
  );
  const label = `${monthLabel(lang, period.month)} · ${period.half === 1 ? tp("quincena_1") : tp("quincena_2")} ${period.year}`;
  const th = "px-3 py-2 text-xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border px-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setPeriod((p) => previousPeriod(p.year, p.month, p.half))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-52 text-center text-sm font-medium text-foreground">{label}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setPeriod((p) => nextPeriod(p))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button size="sm" className="ml-auto" disabled={!ready} onClick={() => setImportOpen(true)}>
          <Clock className="size-3.5" />
          {tg("att_import")}
        </Button>
      </div>

      <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{tg("att_how")}</p>

      <div className="rounded-lg border border-border bg-card">
        <p className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">{tg("att_current")}</p>
        {!ready || pending ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{tp("loading")}</p>
        ) : withHours.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{tg("att_none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={th}>{tp("col_empleado")}</th>
                  <th className={`${th} text-right`}>{tp("col_horas_desc")}</th>
                  <th className={`${th} text-right`}>{tp("col_dias_desc")}</th>
                  <th className={`${th} text-right`}>{tp("col_extra_hours")}</th>
                </tr>
              </thead>
              <tbody>
                {withHours.map((r) => (
                  <tr key={r.employee.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{r.employee.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.total.entry?.horasDescontadas || "–"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.total.entry?.diasDescontados || "–"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.total.entry?.extraHours || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ready && (
        <AttendanceImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          period={rows.period}
          rows={rows.data}
          onApplied={() => {
            load();
            onApplied();
          }}
        />
      )}
    </div>
  );
}
