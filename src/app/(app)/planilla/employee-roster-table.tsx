"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { buildRoster, type RosterLabels } from "@/lib/planilla/employee-roster";
import { formatDate } from "@/lib/planilla/format";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { downloadRosterPdf } from "./employee-roster-pdf";

/**
 * Tabla con TODOS los empleados y su ficha (vigentes por defecto), para ver
 * de un golpe o bajar en PDF e imprimir. Las columnas de banco y de
 * contacto de emergencia se pueden quitar, y los que ya no laboran se
 * pueden incluir. Respeta la búsqueda de arriba.
 */
export function EmployeeRosterTable({ employees }: { employees: PayrollEmployee[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [showBank, setShowBank] = React.useState(true);
  const [showEmergency, setShowEmergency] = React.useState(true);

  const labels: RosterLabels = {
    cedula: tt("id_type_cedula"),
    pasaporte: tt("id_type_pasaporte"),
    taller: tt("categoria_taller"),
    administrativo: tt("categoria_administrativo"),
    ahorro: tt("bank_type_ahorro"),
    corriente: tt("bank_type_corriente"),
    active: tt("active_label"),
    inactive: tt("inactive_label"),
  };
  const rows = React.useMemo(
    () => buildRoster(employees, { includeInactive }, (iso) => formatDate(lang, iso), labels),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, includeInactive, lang]
  );

  async function onPdf() {
    const now = new Date();
    try {
      await downloadRosterPdf(
        rows,
        { showBank, showEmergency, showStatus: includeInactive },
        {
          company: tt("pdf_company"),
          title: tt("roster_title"),
          generated: `${tt("pdf_generated")} ${now.toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { day: "numeric", month: "long", year: "numeric" })}`,
          columns: {
            n: "#",
            employee: tt("col_empleado"),
            position: tt("pd_position"),
            type: tt("pd_category"),
            start: tt("pd_start_date"),
            document: tt("pd_document"),
            nationality: tt("f_nationality"),
            birth: tt("f_birth_date"),
            phone: tt("f_phone"),
            bank: tt("pd_bank"),
            emergency: tt("pd_contact"),
            end: tt("pd_end_date"),
            status: tt("roster_col_status"),
          },
          page: tt("pdf_page"),
        },
        `Empleados-${currentPeriod().year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.pdf`
      );
    } catch (err) {
      console.error("Planilla: no se pudo generar el PDF de empleados", err);
      toast.error(tt("load_failed"));
    }
  }

  const th = "whitespace-nowrap px-2 py-2 text-left font-medium";
  const td = "px-2 py-1.5 align-top";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {(
          [
            { checked: includeInactive, set: setIncludeInactive, label: tt("roster_include_inactive") },
            { checked: showBank, set: setShowBank, label: tt("roster_show_bank") },
            { checked: showEmergency, set: setShowEmergency, label: tt("roster_show_emergency") },
          ] as const
        ).map((o) => (
          <label key={o.label} className="flex cursor-pointer items-center gap-2 text-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={o.checked}
              onChange={(e) => o.set(e.target.checked)}
            />
            {o.label}
          </label>
        ))}
        <Button type="button" size="sm" className="ml-auto" onClick={onPdf} disabled={rows.length === 0}>
          <FileDown className="size-3.5" />
          {tt("roster_pdf")}
        </Button>
      </div>
      {(showBank || showEmergency) && <p className="text-[11px] text-muted-foreground">{tt("roster_sensitive_note")}</p>}

      <div className="overflow-x-auto rounded-none border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className={`${th} text-right`}>#</th>
              <th className={th}>{tt("col_empleado")}</th>
              <th className={th}>{tt("pd_position")}</th>
              <th className={th}>{tt("pd_category")}</th>
              <th className={th}>{tt("pd_start_date")}</th>
              <th className={th}>{tt("pd_document")}</th>
              <th className={th}>{tt("f_nationality")}</th>
              <th className={th}>{tt("f_birth_date")}</th>
              <th className={th}>{tt("f_phone")}</th>
              {showBank && <th className={th}>{tt("pd_bank")}</th>}
              {showEmergency && <th className={th}>{tt("pd_contact")}</th>}
              {includeInactive && <th className={th}>{tt("pd_end_date")}</th>}
              {includeInactive && <th className={th}>{tt("roster_col_status")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-border last:border-0 ${r.isActive ? "" : "text-muted-foreground"}`}>
                <td className={`${td} text-right tabular-nums text-muted-foreground`}>{r.n}</td>
                <td className={`${td} font-medium text-foreground`}>{r.name}</td>
                <td className={td}>{r.position}</td>
                <td className={td}>{r.type}</td>
                <td className={`${td} whitespace-nowrap`}>{r.startDate}</td>
                <td className={`${td} whitespace-nowrap`}>{r.document}</td>
                <td className={td}>{r.nationality}</td>
                <td className={`${td} whitespace-nowrap`}>{r.birthDate}</td>
                <td className={`${td} whitespace-nowrap`}>{r.phone}</td>
                {showBank && <td className={td}>{r.bank}</td>}
                {showEmergency && <td className={td}>{r.emergency}</td>}
                {includeInactive && <td className={`${td} whitespace-nowrap`}>{r.endDate}</td>}
                {includeInactive && <td className={td}>{r.status}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
