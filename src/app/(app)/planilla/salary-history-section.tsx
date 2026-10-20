"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";

import type { PayrollEmployee, PayrollSalaryChange } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getSalaryChangesAction } from "./actions";
import { SalaryRaiseDialog } from "./salary-raise-dialog";

/**
 * Sección "Sueldo / Aumentos" del perfil. El sueldo actual que se
 * muestra sale del reflejo `employee.baseSalaryCents` (siempre
 * recalculado del historial). "Registrar aumento" agrega una fila nueva
 * al historial; la lista muestra cada tramo con su quincena efectiva y
 * notas.
 */
export function SalaryHistorySection({
  employee,
  initialChanges,
}: {
  employee: PayrollEmployee;
  /** Historial ya cargado por el servidor al abrir la página: evita una
   *  llamada más (y su espera) al entrar al perfil. */
  initialChanges?: PayrollSalaryChange[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [changes, setChanges] = React.useState<PayrollSalaryChange[] | null>(initialChanges ?? null);
  const [raiseOpen, setRaiseOpen] = React.useState(false);

  const load = React.useCallback(() => {
    getSalaryChangesAction(employee.id).then(setChanges);
  }, [employee.id]);

  React.useEffect(() => {
    if (initialChanges) return;
    load();
  }, [load, initialChanges]);

  // Más reciente arriba.
  const sorted = React.useMemo(
    () =>
      [...(changes ?? [])].sort(
        (a, b) =>
          b.effectiveYear * 24 +
          (b.effectiveMonth - 1) * 2 +
          (b.effectiveHalf - 1) -
          (a.effectiveYear * 24 + (a.effectiveMonth - 1) * 2 + (a.effectiveHalf - 1))
      ),
    [changes]
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{tt("salary_section_title")}</h3>
          <p className="text-xs text-muted-foreground">
            {tt("current_salary")}: <span className="font-medium text-foreground">{formatCents(employee.baseSalaryCents)}</span>{" "}
            {tt("per_month")}
            {employee.benefitsBaseSalaryCents != null &&
              employee.benefitsBaseSalaryCents !== employee.baseSalaryCents && (
                <>
                  {" · "}
                  {tt("f_benefits_salary")}: {formatCents(employee.benefitsBaseSalaryCents)}
                </>
              )}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setRaiseOpen(true)}>
          <TrendingUp className="size-3.5" />
          {tt("register_raise")}
        </Button>
      </div>

      {changes === null ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tt("salary_history_empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1.5 font-medium">{tt("salary_col_from")}</th>
                <th className="py-1.5 text-right font-medium">{tt("salary_col_monthly")}</th>
                <th className="py-1.5 text-right font-medium">{tt("salary_col_benefits")}</th>
                <th className="py-1.5 font-medium">{tt("salary_col_notes")}</th>
                <th className="py-1.5 text-right font-medium">{tt("salary_col_registered")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 text-foreground">
                    {monthShort(lang, c.effectiveMonth)} {c.effectiveYear} ·{" "}
                    {c.effectiveHalf === 1 ? tt("quincena_1") : tt("quincena_2")}
                    {i === 0 && (
                      <span className="ml-1 rounded-lg bg-primary/15 px-1 text-[10px] font-medium text-primary">
                        {tt("current_label")}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{formatCents(c.monthlySalaryCents)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {c.benefitsBaseSalaryCents != null ? formatCents(c.benefitsBaseSalaryCents) : "—"}
                  </td>
                  <td className="max-w-48 truncate py-1.5 text-muted-foreground" title={c.notes ?? undefined}>
                    {c.notes ?? "—"}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {formatDate(lang, c.createdAt.slice(0, 10))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SalaryRaiseDialog employeeId={employee.id} open={raiseOpen} onOpenChange={setRaiseOpen} onSaved={load} />
    </div>
  );
}
