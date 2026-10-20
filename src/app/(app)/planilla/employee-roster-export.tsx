"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildRoster, type RosterLabels } from "@/lib/planilla/employee-roster";
import { formatDate } from "@/lib/planilla/format";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { countryName } from "@/lib/countries";
import { downloadRosterPdf } from "./employee-roster-pdf";

/**
 * Botón "Descargar PDF" de Staff: la lista de TODOS los empleados con su
 * ficha (vigentes por defecto), para imprimir. Antes de bajarlo se elige si
 * incluir a los que ya no laboran, los datos bancarios y el contacto de
 * emergencia.
 */
export function EmployeeRosterExport({ employees }: { employees: PayrollEmployee[] }) {
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
    country: (code) => countryName(code, lang),
  };

  async function onPdf() {
    const rows = buildRoster(employees, { includeInactive }, (iso) => formatDate(lang, iso), labels);
    if (rows.length === 0) return;
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

  // Las opciones son casillas: tocarlas no cierra el menú.
  const keepOpen = (e: Event) => e.preventDefault();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={employees.length === 0}>
          <FileDown className="size-3.5" />
          {tt("roster_pdf")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{tt("roster_title")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(v === true)} onSelect={keepOpen}>
          {tt("roster_include_inactive")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showBank} onCheckedChange={(v) => setShowBank(v === true)} onSelect={keepOpen}>
          {tt("roster_show_bank")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showEmergency} onCheckedChange={(v) => setShowEmergency(v === true)} onSelect={keepOpen}>
          {tt("roster_show_emergency")}
        </DropdownMenuCheckboxItem>
        {(showBank || showEmergency) && (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">{tt("roster_sensitive_note")}</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void onPdf()}>
          <FileDown className="size-3.5" />
          {tt("roster_pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
