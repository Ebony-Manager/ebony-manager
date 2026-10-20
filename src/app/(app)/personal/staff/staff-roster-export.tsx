"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildRoster, type RosterKind, type RosterLabels } from "@/lib/personal/staff-roster";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { countryName } from "@/lib/countries";
import { downloadRosterPdf } from "./staff-roster-pdf";

/**
 * Botón "Descargar PDF" de Staff: la lista del staff con su ficha, para
 * imprimir. Antes de bajarlo se elige a quiénes (todos, solo empleados o
 * solo contratistas — si el usuario ve los dos) y si incluir a los que ya
 * no laboran, los datos bancarios y el contacto de emergencia.
 */
export function StaffRosterExport({
  employees,
  contractors,
  canEmployees,
  canContractors,
}: {
  employees: PayrollEmployee[];
  contractors: Contractor[];
  canEmployees: boolean;
  canContractors: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const ts = (k: keyof typeof strings.staff) => t(lang, strings.staff[k]);

  const canChoose = canEmployees && canContractors;
  const [kind, setKind] = React.useState<RosterKind>(canChoose ? "all" : canEmployees ? "employee" : "contractor");
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [showBank, setShowBank] = React.useState(true);
  const [showEmergency, setShowEmergency] = React.useState(true);

  const labels: RosterLabels = {
    cedula: tt("id_type_cedula"),
    pasaporte: tt("id_type_pasaporte"),
    taller: tt("categoria_taller"),
    administrativo: tt("categoria_administrativo"),
    contractor: ts("kind_contractor"),
    ebanista: ts("group_ebanista"),
    pintor: ts("group_pintor"),
    ahorro: tt("bank_type_ahorro"),
    corriente: tt("bank_type_corriente"),
    active: tt("active_label"),
    inactive: tt("inactive_label"),
    country: (code) => countryName(code, lang),
  };

  const TITLE: Record<RosterKind, keyof typeof strings.staff> = {
    all: "export_title_all",
    employee: "export_title_employee",
    contractor: "export_title_contractor",
  };
  const FILE: Record<RosterKind, string> = { all: "Staff", employee: "Empleados", contractor: "Contratistas" };

  async function onPdf() {
    const rows = buildRoster({ employees, contractors }, { includeInactive, kind }, (iso) => formatDate(lang, iso), labels);
    if (rows.length === 0) {
      toast.error(ts("export_empty"));
      return;
    }
    const now = new Date();
    try {
      await downloadRosterPdf(
        rows,
        { showPosition: kind !== "contractor", showBank, showEmergency, showStatus: includeInactive },
        {
          company: tt("pdf_company"),
          title: ts(TITLE[kind]),
          generated: `${tt("pdf_generated")} ${now.toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { day: "numeric", month: "long", year: "numeric" })}`,
          columns: {
            n: "#",
            employee: kind === "employee" ? tt("col_empleado") : ts("col_person"),
            position: tt("pd_position"),
            type: ts("col_type"),
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
        `${FILE[kind]}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.pdf`
      );
    } catch (err) {
      console.error("Staff: no se pudo generar el PDF", err);
      toast.error(tt("load_failed"));
    }
  }

  // Las opciones son casillas: tocarlas no cierra el menú.
  const keepOpen = (e: Event) => e.preventDefault();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <FileDown className="size-3.5" />
          {tt("roster_pdf")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {canChoose && (
          <>
            <DropdownMenuLabel>{ts("export_who")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={kind} onValueChange={(v) => setKind(v as RosterKind)}>
              <DropdownMenuRadioItem value="all" onSelect={keepOpen}>
                {ts("filter_all")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="employee" onSelect={keepOpen}>
                {ts("filter_employee")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="contractor" onSelect={keepOpen}>
                {ts("filter_contractor")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>{ts("export_include")}</DropdownMenuLabel>
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
