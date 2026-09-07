// Bilingual strings — ES (primary) / EN (secondary).
//
// Trimmed to what the foundation shell (Sidebar/Navbar/Login) needs. The
// old quote.*/plan.* dictionaries lived here too, but those belong to
// Cotización, which is archived in _legacy/ and not wired into the new
// app — porting its strings here would just be dead weight. They're still
// in _legacy/src/lib/i18n.js when Cotización gets rebuilt.

export type Lang = "es" | "en";

interface Entry {
  es: string;
  en: string;
}

export const strings = {
  nav: {
    cotizacion: { es: "Cotización", en: "Quote" },
    proyectos: { es: "Proyectos", en: "Projects" },
    cronograma: { es: "Cronograma", en: "Schedule" },
    gastos: { es: "Gastos", en: "Expenses" },
    dashboard: { es: "Dashboard", en: "Dashboard" },
    planilla: { es: "Planilla", en: "Payroll" },
  },

  // Módulo Planilla (Fase 2). Solo-admin. Portado de Atlas — todo el
  // texto visible pasa por acá para salir ES/EN.
  planilla: {
    title: { es: "Planilla", en: "Payroll" },
    subtitle: { es: "Empleados asalariados por quincena", en: "Salaried employees, paid biweekly" },
    tab_registro: { es: "Registro", en: "Register" },
    tab_empleados: { es: "Empleados", en: "Employees" },
    add_employee: { es: "Agregar empleado", en: "Add employee" },

    dlg_add_title: { es: "Agregar empleado", en: "Add employee" },
    dlg_add_desc: { es: "Se agrega a la planilla.", en: "Added to the payroll." },
    dlg_edit_title: { es: "Editar empleado", en: "Edit employee" },
    dlg_edit_desc: { es: "Datos personales y de planilla.", en: "Personal and payroll details." },

    f_name: { es: "Nombre", en: "Name" },
    f_name_ph: { es: "Nombre completo", en: "Full name" },
    f_position: { es: "Posición", en: "Position" },
    f_optional: { es: "Opcional", en: "Optional" },
    f_start_date: { es: "Fecha de ingreso", en: "Start date" },
    f_base_salary: { es: "Salario base (mensual)", en: "Base salary (monthly)" },
    f_benefits_salary: { es: "Salario para prestaciones", en: "Benefits base salary" },
    f_benefits_hint: { es: "Igual al salario base si se deja vacío", en: "Same as base salary if left empty" },
    f_phone: { es: "Teléfono", en: "Phone" },
    f_id_document: { es: "Cédula o Pasaporte", en: "ID / Passport" },
    f_emg_name: { es: "Contacto de emergencia", en: "Emergency contact" },
    f_emg_phone: { es: "Teléfono de emergencia", en: "Emergency phone" },
    f_contract: { es: "Contrato", en: "Contract" },
    f_contract_ph: { es: "Ej. Indefinido, firmado 2024-03-01", en: "e.g. Permanent, signed 2024-03-01" },
    f_notes: { es: "Notas", en: "Notes" },
    f_name_required: { es: "El nombre es obligatorio.", en: "Name is required." },

    action_add: { es: "Agregar", en: "Add" },
    action_save: { es: "Guardar", en: "Save" },
    action_cancel: { es: "Cancelar", en: "Cancel" },
    action_edit: { es: "Editar", en: "Edit" },
    saving: { es: "Guardando…", en: "Saving…" },

    search_ph: {
      es: "Buscar por nombre, posición, teléfono, cédula…",
      en: "Search by name, position, phone, ID…",
    },
    no_position: { es: "Sin posición", en: "No position" },
    no_phone: { es: "Sin teléfono", en: "No phone" },
    no_id: { es: "Sin cédula/pasaporte", en: "No ID / passport" },
    inactive: { es: "Inactivo", en: "Inactive" },
    no_longer_work: { es: "Ya no laboran", en: "No longer employed" },
    no_results: { es: "Sin resultados", en: "No results" },
    no_results_desc: { es: "Nada coincide con esa búsqueda.", en: "Nothing matches that search." },
    empty_employees: {
      es: "Agrega al menos un empleado para empezar.",
      en: "Add at least one employee to get started.",
    },
    profile_fallback: { es: "Perfil del empleado", en: "Employee profile" },
    documents_deferred: {
      es: "La sección de documentos llega en una entrega posterior.",
      en: "The documents section arrives in a later batch.",
    },

    kpi_total_due: { es: "Total a Pagar", en: "Total to Pay" },
    kpi_cash: { es: "Pago en Efectivo", en: "Cash Payment" },
    kpi_decimo: { es: "Décimo del período", en: "13th month, this period" },
    kpi_deductions: { es: "Descuentos del período", en: "Deductions, this period" },
    kpi_next_pay: { es: "Próximo pago", en: "Next pay date" },
    kpi_employees_count: { es: "empleados", en: "employees" },
    kpi_pct_of_total: { es: "del total", en: "of total" },

    quincena_1: { es: "1ra Quincena", en: "1st Half" },
    quincena_2: { es: "2da Quincena", en: "2nd Half" },
    duplicate_prev: { es: "Duplicar quincena anterior", en: "Copy previous period" },
    columns: { es: "Columnas", en: "Columns" },

    col_empleado: { es: "Empleado", en: "Employee" },
    col_base: { es: "Base", en: "Base" },
    col_extra_hours: { es: "Horas Extra", en: "Overtime Hours" },
    col_extra_days: { es: "Días Extra", en: "Extra Days" },
    col_bonos: { es: "Bonos", en: "Bonuses" },
    col_dias_libres: { es: "Días Libres", en: "Paid Days Off" },
    col_horas_desc: { es: "Horas Descontadas", en: "Docked Hours" },
    col_dias_desc: { es: "Días Descontados", en: "Docked Days" },
    col_otros_desc: { es: "Otros Descuentos", en: "Other Deductions" },
    col_decimo: { es: "Décimo", en: "13th Month" },
    col_vacacion: { es: "Vacación", en: "Vacation" },
    col_prima: { es: "Prima Antigüedad", en: "Seniority Premium" },
    col_metodo: { es: "Método", en: "Method" },
    col_pagado: { es: "Pagado", en: "Paid" },
    col_total: { es: "Total", en: "Total" },
    total_quincena: { es: "Total quincena", en: "Period total" },

    pm_efectivo: { es: "Efectivo", en: "Cash" },
    pm_transferencia: { es: "Transferencia", en: "Transfer" },
    pm_yappy: { es: "Yappy", en: "Yappy" },
    pm_cheque: { es: "Cheque", en: "Check" },

    empty_registro: {
      es: "Agrega al menos un empleado para empezar a registrar pagos.",
      en: "Add at least one employee to start recording payments.",
    },
    loading: { es: "Cargando…", en: "Loading…" },
  },

  common: {
    loading: { es: "Cargando…", en: "Loading…" },
    comingSoon: { es: "Este módulo estará disponible próximamente.", en: "This module will be available soon." },
  },

  auth: {
    signIn: { es: "Iniciar sesión con Google", en: "Sign in with Google" },
    signOut: { es: "Cerrar sesión", en: "Sign out" },
    welcome: { es: "Bienvenido a Ebony Manager", en: "Welcome to Ebony Manager" },
    subtitle: {
      es: "Sistema de gestión para Ebony Custom Woodwork",
      en: "Management system for Ebony Custom Woodwork",
    },
  },
} as const satisfies Record<string, Record<string, Entry>>;

/** Get a string in the current language. Usage: t(lang, strings.nav.cotizacion) */
export function t(lang: Lang, entry: Entry): string {
  if (!entry) return "";
  return entry[lang] ?? entry.es ?? "";
}
