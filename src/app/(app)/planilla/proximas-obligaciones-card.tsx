"use client";

import { Award, Umbrella, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { UpcomingObligations } from "@/types/planilla";
import { formatCents } from "@/lib/planilla/payroll-period";
import { monthYear } from "@/lib/planilla/format";
import {
  payrollCategoryTint,
  payrollCategoryTextStyle,
  type PayrollCategoryKey,
} from "@/lib/planilla/payroll-colors";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

function ObligationRow({
  icon: Icon,
  category,
  title,
  value,
  sublabel,
}: {
  icon: LucideIcon;
  category: PayrollCategoryKey;
  title: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-none px-2 py-2" style={payrollCategoryTint(category, 10)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-none" style={payrollCategoryTint(category, 22)}>
        <Icon className="size-4" style={payrollCategoryTextStyle(category)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{title}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

export function ProximasObligacionesCard({ obligations }: { obligations: UpcomingObligations }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const n = obligations.employeesWithLoanBalance;

  return (
    <div className="flex flex-col gap-2 rounded-none border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">{tt("prox_obligaciones")}</p>
      <ObligationRow
        icon={Award}
        category="decimo"
        title={tt("decimos_por_pagar")}
        value={formatCents(obligations.decimoPendingCents)}
        sublabel={`${tt("vence_en")} ${monthYear(lang, obligations.decimoDueDate)}`}
      />
      <ObligationRow
        icon={Umbrella}
        category="vacacion"
        title={tt("vacaciones_por_pagar")}
        value={formatCents(obligations.vacacionPendingCents)}
        sublabel={tt("acumulado_sin_pagar")}
      />
      <ObligationRow
        icon={Users}
        category="prestamos"
        title={tt("prestamos_pendientes")}
        value={formatCents(obligations.prestamosPendingCents)}
        sublabel={n > 0 ? `${n} ${n === 1 ? tt("kpi_employees_count").replace(/s$/, "") : tt("kpi_employees_count")} ${tt("con_saldo")}` : tt("sin_saldos")}
      />
    </div>
  );
}
