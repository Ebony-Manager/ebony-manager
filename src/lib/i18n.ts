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
    contratistas: { es: "Contratistas", en: "Contractors" },
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
    view_detail: { es: "Ver detalle", en: "View detail" },
    view_detail_annual: { es: "Ver detalle anual", en: "View annual detail" },

    // Tabs B2
    tab_dashboard: { es: "Dashboard", en: "Dashboard" },
    tab_resumen: { es: "Resumen Anual", en: "Annual Summary" },
    tab_auditoria: { es: "Auditoría", en: "Audit" },

    // Categorías (leyendas)
    cat_salario: { es: "Salario", en: "Salary" },
    cat_bonos: { es: "Bonos y Extras", en: "Bonuses & Extras" },
    cat_decimo: { es: "Décimo", en: "13th Month" },
    cat_vacacion: { es: "Vacación", en: "Vacation" },
    cat_prima: { es: "Prima Antigüedad", en: "Seniority Premium" },
    cat_descuentos: { es: "Descuentos", en: "Deductions" },
    cat_descuento_prestamos: { es: "Descuento a Préstamos", en: "Loan Deductions" },
    cat_prestamos: { es: "Préstamos", en: "Loans" },
    cat_total: { es: "Total", en: "Total" },
    prestaciones: { es: "Prestaciones", en: "Benefits" },

    // Préstamos / adelantos / ledger
    loans_title: { es: "Préstamos y adelantos", en: "Loans & advances" },
    loans_balance: { es: "Saldo actual", en: "Current balance" },
    loan_new_prestamo: { es: "Préstamo", en: "Loan" },
    loan_new_adelanto: { es: "Adelanto", en: "Advance" },
    loans_empty: { es: "Sin préstamos ni adelantos registrados.", en: "No loans or advances on record." },
    loan_dlg_prestamo_title: { es: "Nuevo préstamo", en: "New loan" },
    loan_dlg_adelanto_title: { es: "Nuevo adelanto", en: "New advance" },
    loan_dlg_prestamo_desc: {
      es: "Un préstamo se reparte en cuotas iguales entre varias quincenas seguidas. Se aplica solo a sus quincenas: no hay que acordarse cada vez que se registra la planilla.",
      en: "A loan is split into equal installments across consecutive periods. It applies to those periods on its own — no need to remember it each payroll run.",
    },
    loan_dlg_adelanto_desc: {
      es: "Un adelanto se descuenta completo de una sola quincena — normalmente la que está en curso cuando se solicita.",
      en: "An advance is deducted in full from a single period — usually the one in progress when requested.",
    },
    loan_f_type: { es: "Tipo", en: "Type" },
    loan_type_prestamo: { es: "Préstamo (en cuotas)", en: "Loan (installments)" },
    loan_type_adelanto: { es: "Adelanto (una sola quincena)", en: "Advance (single period)" },
    loan_f_amount: { es: "Monto", en: "Amount" },
    loan_f_request_date: { es: "Fecha de solicitud", en: "Request date" },
    loan_f_installments: { es: "Cuotas (quincenas)", en: "Installments (periods)" },
    loan_f_scheme: { es: "Forma de pago", en: "Payment scheme" },
    loan_scheme_fija: { es: "Cuota fija (partes iguales)", en: "Fixed installment (equal parts)" },
    loan_f_first_period: { es: "Primera cuota en la quincena", en: "First installment in period" },
    loan_f_deduct_period: { es: "Se descuenta de la quincena", en: "Deducted from period" },
    loan_period_hint: {
      es: "Calculada según la fecha de solicitud — se puede cambiar si hace falta.",
      en: "Computed from the request date — change it if needed.",
    },
    loan_submit_prestamo: { es: "Registrar préstamo", en: "Register loan" },
    loan_submit_adelanto: { es: "Registrar adelanto", en: "Register advance" },
    loan_f_amount_required: { es: "El monto es obligatorio.", en: "Amount is required." },
    loan_preview_adelanto: { es: "Se descuenta completo de la quincena de", en: "Deducted in full from the period of" },
    loan_preview_installments: { es: "cuotas de", en: "installments of" },
    loan_preview_last: { es: "última", en: "last" },
    loan_preview_starting: { es: "empezando en", en: "starting" },
    loan_preview_payoff: { es: "Fecha estimada de pago total:", en: "Estimated payoff date:" },
    loan_installments_paid: { es: "cuotas pagadas", en: "installments paid" },
    loan_next_installment: { es: "Próxima cuota:", en: "Next installment:" },
    loan_payoff_est: { es: "Pago total estimado:", en: "Estimated payoff:" },
    loan_deducted_from: { es: "Descontado de", en: "Deducted from" },
    loan_applied: { es: "ya aplicado", en: "applied" },
    loan_pending: { es: "pendiente", en: "pending" },
    loan_cancelled: { es: "cancelado", en: "cancelled" },
    loan_cancel_title: { es: "Cancelar cuotas pendientes", en: "Cancel pending installments" },
    loan_requested: { es: "Solicitado", en: "Requested" },
    loan_of: { es: "de", en: "of" },

    movimientos_title: { es: "Herramientas, daños y otros movimientos", en: "Tools, damages & other movements" },
    movimiento_add: { es: "Agregar movimiento", en: "Add movement" },
    movimientos_empty: { es: "Sin movimientos registrados.", en: "No movements on record." },
    mov_dlg_title: { es: "Agregar movimiento", en: "Add movement" },
    mov_dlg_desc: {
      es: "Herramienta, daño u otro cargo/abono — préstamos y adelantos se registran aparte, con su calendario de cuotas.",
      en: "Tool, damage or other charge/credit — loans and advances are recorded separately, with their installment schedule.",
    },
    mov_f_category: { es: "Categoría", en: "Category" },
    mov_f_type: { es: "Tipo", en: "Type" },
    mov_type_debt: { es: "Otorgado (el empleado lo debe)", en: "Charged (employee owes it)" },
    mov_type_payment: { es: "Abono (el empleado pagó)", en: "Credit (employee paid)" },
    mov_f_amount: { es: "Monto", en: "Amount" },
    mov_f_date: { es: "Fecha", en: "Date" },
    mov_f_apply_period: { es: "Aplicar a la quincena (opcional)", en: "Apply to period (optional)" },
    mov_period_none: { es: "Ninguna — no aplica a una quincena específica", en: "None — not tied to a period" },
    mov_period_hint: {
      es: "Un abono solo se descuenta del total de esa quincena si se aplica a una.",
      en: "A credit only reduces a period's total if it is applied to one.",
    },
    mov_f_notes: { es: "Notas", en: "Notes" },
    mov_col_date: { es: "Fecha", en: "Date" },
    mov_col_category: { es: "Categoría", en: "Category" },
    mov_col_period: { es: "Quincena", en: "Period" },
    mov_col_amount: { es: "Monto", en: "Amount" },
    mov_col_notes: { es: "Notas", en: "Notes" },
    mov_delete_title: { es: "Eliminar movimiento", en: "Delete movement" },

    ledger_cat_prestamo: { es: "Préstamo", en: "Loan" },
    ledger_cat_adelanto: { es: "Adelanto", en: "Advance" },
    ledger_cat_herramienta: { es: "Herramienta", en: "Tool" },
    ledger_cat_dano: { es: "Daño", en: "Damage" },
    ledger_cat_seguro_social: { es: "Seguro Social", en: "Social Security" },
    ledger_cat_carnet: { es: "Carnet", en: "Permit" },
    ledger_cat_otro: { es: "Otro", en: "Other" },

    // Liquidación
    liq_mark: { es: "Marcar liquidación", en: "Mark settlement" },
    liq_edit: { es: "Editar liquidación", en: "Edit settlement" },
    liq_desc: {
      es: "Fecha exacta de liquidación y notas de aclaración o disputa.",
      en: "Exact settlement date and any clarification or dispute notes.",
    },
    liq_hint: {
      es: "Esta fecha solo reinicia el cálculo de Décimo/Vacación/Prima de Antigüedad hacia adelante — no cambia si el empleado está activo. Para eso usa el botón de Activar/Desactivar en su fila.",
      en: "This date only resets the 13th-month/Vacation/Seniority accrual going forward — it does not change whether the employee is active. Use the Activate/Deactivate button on their row for that.",
    },
    liq_f_date: { es: "Fecha de liquidación", en: "Settlement date" },
    liq_f_notes: { es: "Notas de liquidación", en: "Settlement notes" },
    liq_f_date_required: { es: "La fecha es obligatoria.", en: "Date is required." },

    // Resumen Anual
    resumen_title: { es: "Resumen Anual", en: "Annual Summary" },
    resumen_subtitle: {
      es: "Vista anual por empleado. Haz clic en un empleado para ver el desglose mensual y por concepto.",
      en: "Annual view per employee. Click an employee for the monthly and per-concept breakdown.",
    },
    project_next: { es: "Proyectar próximos meses", en: "Project upcoming months" },
    stat_total_anual: { es: "Total Anual", en: "Annual Total" },
    stat_pagado: { es: "Pagado", en: "Paid" },
    stat_pendiente: { es: "Pendiente", en: "Pending" },
    stat_prom_mensual: { es: "Prom. mensual", en: "Monthly avg." },
    months_label: { es: "meses", en: "months" },
    active_label: { es: "Activo", en: "Active" },
    inactive_label: { es: "Inactivo", en: "Inactive" },
    base_salary_month: { es: "Salario base", en: "Base salary" },
    per_month: { es: "/ mes", en: "/ mo" },
    liquidated_on: { es: "Liquidado", en: "Settled" },
    last_liquidation: { es: "Última liquidación", en: "Last settlement" },
    liq_notes_title: { es: "Notas de liquidación", en: "Settlement notes" },
    desglose_concepto: { es: "Desglose anual por concepto", en: "Annual breakdown by concept" },
    no_longer_work_full: { es: "Empleados que no laboran más", en: "Employees no longer working" },
    no_employees_yet: { es: "Sin empleados todavía.", en: "No employees yet." },
    mark_inactive: { es: "Marcar como inactivo", en: "Mark as inactive" },
    reactivate: { es: "Reactivar", en: "Reactivate" },
    concept_salario_base: { es: "Salario Base", en: "Base Salary" },
    concept_decimo: { es: "Décimo", en: "13th Month" },
    concept_vacaciones: { es: "Vacaciones", en: "Vacation" },
    concept_prima: { es: "Prima Antigüedad", en: "Seniority Premium" },
    concept_descuentos: { es: "Descuentos", en: "Deductions" },
    concept_prestamos: { es: "Préstamos", en: "Loans" },
    chart_total: { es: "Total", en: "Total" },
    chart_acumulado: { es: "Acumulado", en: "Cumulative" },

    // Dashboard
    dashboard_subtitle: { es: "Cómo va tu planilla, de un vistazo.", en: "How your payroll is doing, at a glance." },
    kpi_total_ytd: { es: "Total Planilla YTD", en: "Payroll Total YTD" },
    kpi_active_employees: { es: "empleados activos", en: "active employees" },
    kpi_month_payroll: { es: "Planilla del mes actual", en: "Current month payroll" },
    kpi_salaries_total: { es: "Salarios totales", en: "Total salaries" },
    kpi_benefits_total: { es: "Prestaciones totales", en: "Total benefits" },
    kpi_deductions_total: { es: "Descuentos totales", en: "Total deductions" },
    kpi_loans_granted: { es: "Préstamos otorgados", en: "Loans granted" },
    kpi_pending_obligations: { es: "Obligaciones pendientes", en: "Pending obligations" },
    kpi_pending_obligations_sub: { es: "Décimo + Vacación + Préstamos", en: "13th month + Vacation + Loans" },
    dist_by_employee: { es: "Distribución por empleado", en: "Distribution by employee" },
    no_payroll_this_year: { es: "Sin datos de planilla este año.", en: "No payroll data this year." },
    evolution_title: { es: "Evolución mensual del gasto total en planilla", en: "Monthly evolution of total payroll cost" },
    no_data_to_chart: { es: "Sin datos de planilla para graficar.", en: "No payroll data to chart." },
    prox_obligaciones: { es: "Próximas obligaciones", en: "Upcoming obligations" },
    decimos_por_pagar: { es: "Décimos por pagar", en: "13th month payable" },
    vacaciones_por_pagar: { es: "Vacaciones por pagar", en: "Vacation payable" },
    prestamos_pendientes: { es: "Préstamos pendientes", en: "Outstanding loans" },
    vence_en: { es: "Vence en", en: "Due" },
    acumulado_sin_pagar: { es: "Acumulado sin pagar", en: "Accrued, unpaid" },
    con_saldo: { es: "con saldo", en: "with balance" },
    sin_saldos: { es: "Sin saldos pendientes", en: "No outstanding balances" },

    // Detalle
    detalle_title: { es: "Detalle de planilla", en: "Payroll detail" },
    no_pagos_en: { es: "Sin pagos registrados en", en: "No payments recorded in" },
    col_quincena: { es: "Quincena", en: "Period" },
    col_extras: { es: "Extras", en: "Extras" },
    col_descuentos: { es: "Descuentos", en: "Deductions" },
    col_prestamos: { es: "Préstamos", en: "Loans" },
    col_saldo: { es: "Saldo", en: "Balance" },
    total_year: { es: "Total", en: "Total" },
    desglose_mensual_toggle: {
      es: "Desglose mensual por concepto (Décimo, Vacación, Prima Antigüedad)",
      en: "Monthly breakdown by concept (13th month, Vacation, Seniority Premium)",
    },
    concept_col: { es: "Concepto", en: "Concept" },
    br_salario_base: { es: "Salario base", en: "Base salary" },
    br_extras: { es: "Horas/días extra, viáticos, bonos", en: "OT hours/days, per-diems, bonuses" },
    br_dias_libres: { es: "Días libres", en: "Paid days off" },
    br_descuentos: { es: "Descuentos", en: "Deductions" },
    br_abono: { es: "Abono a préstamo/adelanto", en: "Loan/advance repayment" },
    br_prestamo_otorgado: { es: "Préstamo/adelanto otorgado (no es pago)", en: "Loan/advance granted (not pay)" },
    br_prima_note: { es: "Prima de antigüedad (se paga solo al terminar o liquidar)", en: "Seniority premium (paid only on termination/settlement)" },
    br_vacacion: { es: "Vacación proporcional", en: "Prorated vacation" },
    accrual_on_benefits: { es: "calculado sobre", en: "computed on" },
    accrual_benefits_suffix: { es: "prestaciones", en: "benefits" },
    accrual_real_reference: { es: "si fuera sobre salario real", en: "if on real salary" },
    reference_suffix: { es: "referencia", en: "reference" },

    // Auditoría
    auditoria_title: { es: "Auditoría de Planilla", en: "Payroll Audit" },
    auditoria_subtitle: {
      es: "Vista anual detallada por quincena, para verificación y control de datos.",
      en: "Detailed annual view per period, for data verification and control.",
    },
    auditoria_note_monthly: {
      es: "Todos los valores en USD, consolidados por mes. Cambia a Quincenal, Por concepto o Micro para ver el desglose por quincena.",
      en: "All values in USD, consolidated by month. Switch to Biweekly, By concept or Micro for the per-period breakdown.",
    },
    auditoria_note_biweekly: {
      es: "Todos los valores en USD, desglosados por 1ra y 2da quincena de cada mes.",
      en: "All values in USD, broken down by 1st and 2nd half of each month.",
    },
    findings_title: { es: "Hallazgos de auditoría", en: "Audit findings" },
    finding_paid_zero: { es: "marcado como pagado pero el total es", en: "marked as paid but the total is" },
    finding_negative: { es: "total negativo", en: "negative total" },
    finding_gap: {
      es: "posible período faltante entre {a} y {b} — sin liquidación registrada de por medio.",
      en: "possible missing period between {a} and {b} — no settlement on record in between.",
    },
    filtros: { es: "Filtros", en: "Filters" },
    secciones: { es: "Secciones", en: "Sections" },
    proyeccion_prestaciones: { es: "Proyección de prestaciones", en: "Benefits projection" },
    comparar_base: { es: "Comparar con Base", en: "Compare to Base" },
    exportar: { es: "Exportar", en: "Export" },
    vista: { es: "Vista", en: "View" },
    densidad: { es: "Densidad", en: "Density" },
    comprimida: { es: "Comprimida", en: "Compact" },
    expandida: { es: "Expandida", en: "Expanded" },
    nivel_detalle: { es: "Nivel de detalle", en: "Detail level" },
    nivel_macro: { es: "Macro", en: "Macro" },
    nivel_quincenal: { es: "Quincenal", en: "Biweekly" },
    nivel_concepto: { es: "Por concepto", en: "By concept" },
    nivel_micro: { es: "Micro", en: "Micro" },
    estado: { es: "Estado", en: "Status" },
    filtro_todos: { es: "Todos", en: "All" },
    filtro_activo: { es: "Activo", en: "Active" },
    filtro_inactivo: { es: "Inactivo", en: "Inactive" },
    limpiar_filtros: { es: "Limpiar filtros", en: "Clear filters" },
    total_planilla: { es: "Total Planilla", en: "Payroll Total" },
    total_general: { es: "Total General", en: "Grand Total" },
    quincena_base: { es: "Quincena Base", en: "Base Period" },
    grp_salarios: { es: "Salarios", en: "Salaries" },
    grp_prestaciones: { es: "Prestaciones", en: "Benefits" },
    grp_bonificaciones: { es: "Bonificaciones & Extras", en: "Bonuses & Extras" },
    grp_descuentos: { es: "Descuentos", en: "Deductions" },
    grp_prestamos_otros: { es: "Préstamos & Otros", en: "Loans & Others" },
    grp_descuento_prestamos: { es: "Descuento a Préstamos", en: "Loan Deductions" },
    li_quincena_base: { es: "Quincena Base", en: "Base Period" },
    li_dias_libres: { es: "Días Libres", en: "Paid Days Off" },
    li_decimo: { es: "Décimo", en: "13th Month" },
    li_vacacion: { es: "Vacación Proporcional", en: "Prorated Vacation" },
    li_prima: { es: "Prima de Antigüedad", en: "Seniority Premium" },
    li_seguro_social: { es: "Caja de Seguro Social", en: "Social Security" },
    li_horas_extra: { es: "Horas Extras", en: "Overtime Hours" },
    li_dias_extra: { es: "Días Extras", en: "Extra Days" },
    li_viaticos: { es: "Viáticos", en: "Per-diems" },
    li_bonos: { es: "Bonificaciones Extras", en: "Extra Bonuses" },
    li_horas_descontadas: { es: "Horas Descontadas", en: "Docked Hours" },
    li_dias_descontados: { es: "Días Descontados", en: "Docked Days" },
    li_otros_descuentos: { es: "Otros Descuentos", en: "Other Deductions" },
    li_prestamos: { es: "Préstamos", en: "Loans" },
    li_adelantos: { es: "Adelantos", en: "Advances" },
    li_herramientas: { es: "Herramientas", en: "Tools" },
    li_danos: { es: "Daños", en: "Damages" },
    li_desc_prestamos: { es: "Descuento a Préstamos", en: "Loan Deduction" },
    li_desc_adelantos: { es: "Descuento a Adelantos", en: "Advance Deduction" },
    li_desc_herramientas: { es: "Descuento a Herramientas", en: "Tool Deduction" },
    li_desc_danos: { es: "Descuento por Daños", en: "Damage Deduction" },

    // Sueldo / Aumentos
    base_readonly_hint: {
      es: "Se llena sola con el sueldo vigente de esta quincena (Sueldo / Aumentos en el perfil).",
      en: "Auto-filled from the salary in effect this period (Salary / Raises in the profile).",
    },
    salary_edit_note: {
      es: "El sueldo se cambia registrando un aumento en la sección “Sueldo / Aumentos” del perfil.",
      en: "Change salary by registering a raise in the profile's “Salary / Raises” section.",
    },
    salary_section_title: { es: "Sueldo / Aumentos", en: "Salary / Raises" },
    current_salary: { es: "Sueldo actual", en: "Current salary" },
    current_label: { es: "actual", en: "current" },
    register_raise: { es: "Registrar aumento", en: "Register raise" },
    salary_history_empty: { es: "Sin historial de sueldos todavía.", en: "No salary history yet." },
    salary_col_from: { es: "Desde", en: "From" },
    salary_col_monthly: { es: "Sueldo mensual", en: "Monthly salary" },
    salary_col_benefits: { es: "Base prestaciones", en: "Benefits base" },
    salary_col_notes: { es: "Notas", en: "Notes" },
    salary_col_registered: { es: "Registrado", en: "Recorded" },

    raise_title: { es: "Registrar aumento de sueldo", en: "Register salary raise" },
    raise_desc: {
      es: "El sueldo nuevo aplica desde el inicio de la quincena elegida en adelante; las quincenas anteriores conservan el sueldo viejo.",
      en: "The new salary applies from the start of the chosen period onward; earlier periods keep the old salary.",
    },
    raise_f_monthly: { es: "Nuevo sueldo mensual", en: "New monthly salary" },
    raise_f_benefits: { es: "Base para prestaciones", en: "Benefits base" },
    raise_f_from: { es: "Vigente desde la quincena", en: "Effective from period" },
    raise_from_hint: {
      es: "Un aumento siempre arranca al inicio de una quincena.",
      en: "A raise always starts at the beginning of a period.",
    },
    raise_notes_ph: { es: "Ej. acuerdo verbal, ajuste anual…", en: "e.g. verbal agreement, annual adjustment…" },
    raise_amount_required: { es: "El sueldo es obligatorio.", en: "Salary is required." },
    raise_submit: { es: "Registrar aumento", en: "Register raise" },
    raise_saved: { es: "Aumento registrado", en: "Raise recorded" },

    // Estado / Liquidación (perfil)
    status_section_title: { es: "Estado / Liquidación", en: "Status / Settlement" },
    status_label: { es: "Estado", en: "Status" },
    status_hint: {
      es: "Inactivar saca al empleado de la lista de activos pero conserva toda su historia (aparece en “Ya no laboran”). La liquidación solo marca la fecha de salida y reinicia el cálculo de Décimo/Vacación/Prima hacia adelante — no cambia si está activo.",
      en: "Deactivating removes the employee from the active list but keeps all their history (shows under “No longer employed”). A settlement only marks the end date and resets the 13th-month/Vacation/Seniority accrual going forward — it does not change whether they are active.",
    },

    // Zona de peligro / borrar
    danger_zone: { es: "Zona de peligro", en: "Danger zone" },
    danger_explain: {
      es: "Inactivar conserva la historia del empleado. Borrar la elimina por completo — quincenas, préstamos, movimientos e historial de sueldos — y no se puede deshacer.",
      en: "Deactivating keeps the employee's history. Deleting removes it entirely — periods, loans, movements and salary history — and cannot be undone.",
    },
    delete_employee: { es: "Eliminar empleado", en: "Delete employee" },
    delete_title: { es: "Eliminar empleado", en: "Delete employee" },
    delete_desc: {
      es: "Esto borra al empleado y TODA su historia de forma permanente.",
      en: "This permanently deletes the employee and ALL their history.",
    },
    delete_warning: {
      es: "Se eliminan también sus quincenas, préstamos/adelantos, movimientos de ledger y el historial de sueldos. Irreversible.",
      en: "Their periods, loans/advances, ledger movements and salary history are deleted too. Irreversible.",
    },
    delete_type_name: { es: "Para confirmar, escribe el nombre exacto:", en: "To confirm, type the exact name:" },
    delete_confirm: { es: "Eliminar para siempre", en: "Delete permanently" },
    delete_done: { es: "Empleado eliminado", en: "Employee deleted" },
  },

  // Módulo Contratistas (Fase 2, Etapa 1). Solo-admin. Ebanistas y
  // pintores por proyecto, con estado de cuenta de saldo calculado.
  contratistas: {
    title: { es: "Contratistas", en: "Contractors" },
    subtitle: { es: "Ebanistas y pintores por proyecto", en: "Per-project cabinetmakers and painters" },

    add_contractor: { es: "Agregar contratista", en: "Add contractor" },
    dlg_add_title: { es: "Agregar contratista", en: "Add contractor" },
    dlg_add_desc: {
      es: "Ebanista o pintor. El estado de cuenta empieza en cero.",
      en: "Cabinetmaker or painter. The account starts at zero.",
    },

    f_name: { es: "Nombre", en: "Name" },
    f_name_ph: { es: "Nombre completo", en: "Full name" },
    f_type: { es: "Tipo", en: "Type" },
    type_ebanista: { es: "Ebanista", en: "Cabinetmaker" },
    type_pintor: { es: "Pintor", en: "Painter" },
    f_id_document: { es: "Cédula o pasaporte", en: "ID / Passport" },
    f_phone: { es: "Teléfono", en: "Phone" },
    f_contact: { es: "Contacto", en: "Contact" },
    f_contact_ph: { es: "Otro número, un familiar, correo…", en: "Another number, a relative, email…" },
    f_start_date: { es: "Fecha de inicio", en: "Start date" },
    f_optional: { es: "Opcional", en: "Optional" },
    f_name_required: { es: "El nombre es obligatorio.", en: "Name is required." },

    action_add: { es: "Agregar", en: "Add" },
    action_save: { es: "Guardar", en: "Save" },
    action_cancel: { es: "Cancelar", en: "Cancel" },
    action_edit: { es: "Editar", en: "Edit" },
    saving: { es: "Guardando…", en: "Saving…" },
    loading: { es: "Cargando…", en: "Loading…" },

    search_ph: { es: "Buscar por nombre, cédula, teléfono…", en: "Search by name, ID, phone…" },
    no_phone: { es: "Sin teléfono", en: "No phone" },
    no_id: { es: "Sin cédula/pasaporte", en: "No ID / passport" },
    no_results: { es: "Sin resultados", en: "No results" },
    no_results_desc: { es: "Nada coincide con esa búsqueda.", en: "Nothing matches that search." },
    empty: {
      es: "Agrega al menos un contratista para empezar.",
      en: "Add at least one contractor to get started.",
    },
    profile_fallback: { es: "Ficha del contratista", en: "Contractor profile" },
    back_to_directory: { es: "Volver al directorio", en: "Back to directory" },
    not_found: { es: "Contratista no encontrado", en: "Contractor not found" },
    not_found_desc: {
      es: "Este contratista no existe o fue eliminado.",
      en: "This contractor doesn't exist or was removed.",
    },

    balance_label: { es: "Saldo", en: "Balance" },
    bal_ebony_owes: { es: "Ebony le debe", en: "Ebony owes them" },
    bal_owes_ebony: { es: "Debe a Ebony", en: "Owes Ebony" },
    bal_settled: { es: "Al día", en: "Settled up" },

    ledger_title: { es: "Estado de cuenta", en: "Account statement" },
    ledger_add: { es: "Agregar movimiento", en: "Add movement" },
    ledger_empty: { es: "Sin movimientos todavía.", en: "No movements yet." },
    col_date: { es: "Fecha", en: "Date" },
    col_category: { es: "Categoría", en: "Category" },
    col_client: { es: "Cliente", en: "Client" },
    col_description: { es: "Descripción", en: "Description" },
    col_mt2: { es: "m²", en: "m²" },
    col_cost_mt2: { es: "Costo/m²", en: "Cost/m²" },
    col_a_favor: { es: "A favor", en: "Credit" },
    col_reduce: { es: "Reduce", en: "Charge" },
    col_balance: { es: "Saldo", en: "Balance" },
    absorbed_note: { es: "Ebony asume — no afecta el saldo", en: "Ebony absorbs — no effect on balance" },

    mov_add_title: { es: "Agregar movimiento", en: "Add movement" },
    mov_edit_title: { es: "Editar movimiento", en: "Edit movement" },
    mov_desc: {
      es: "La categoría define sola si suma o resta al saldo. Solo en “Ajuste” lo eliges tú.",
      en: "The category decides on its own whether it adds to or subtracts from the balance. Only in “Adjustment” do you choose.",
    },
    mov_f_category: { es: "Categoría", en: "Category" },
    mov_f_date: { es: "Fecha", en: "Date" },
    mov_f_adjust_dir: { es: "Este ajuste…", en: "This adjustment…" },
    adjust_a_favor: {
      es: "Suma al saldo (a favor del contratista)",
      en: "Adds to the balance (in the contractor's favor)",
    },
    adjust_reduce: { es: "Resta del saldo", en: "Subtracts from the balance" },
    mov_f_amount_mode: { es: "Monto", en: "Amount" },
    amount_mode_flat: { es: "Monto fijo", en: "Flat amount" },
    amount_mode_area: { es: "m² × costo/m²", en: "m² × cost/m²" },
    mov_f_flat: { es: "Monto", en: "Amount" },
    mov_f_mt2: { es: "m²", en: "m²" },
    mov_f_cost_mt2: { es: "Costo por m²", en: "Cost per m²" },
    mov_computed: { es: "Total calculado", en: "Computed total" },
    mov_f_client: { es: "Cliente (texto libre)", en: "Client (free text)" },
    mov_f_description: { es: "Descripción", en: "Description" },
    mov_f_notes: { es: "Notas", en: "Notes" },
    mov_f_ebony_absorbs: { es: "Ebony asume este material", en: "Ebony absorbs this material" },
    mov_f_ebony_absorbs_hint: {
      es: "Queda registrado pero no afecta el saldo del contratista.",
      en: "It stays on record but does not affect the contractor's balance.",
    },
    mov_amount_required: {
      es: "El monto debe ser mayor que cero.",
      en: "The amount must be greater than zero.",
    },
    mov_delete_title: { es: "Eliminar movimiento", en: "Delete movement" },
    mov_delete_confirm: {
      es: "¿Eliminar este movimiento del estado de cuenta?",
      en: "Delete this movement from the account statement?",
    },
    mov_saved: { es: "Movimiento guardado", en: "Movement saved" },

    // El valor guardado en la base sigue siendo 'trabajo' (enum sin
    // cambios); acá solo cambia la ETIQUETA visible a "Proyecto".
    cat_trabajo: { es: "Proyecto", en: "Project" },
    cat_bono: { es: "Bono", en: "Bonus" },
    cat_extra: { es: "Extra", en: "Extra" },
    cat_pago: { es: "Pago", en: "Payment" },
    cat_prestamo: { es: "Préstamo", en: "Loan" },
    cat_adelanto: { es: "Adelanto", en: "Advance" },
    cat_material: { es: "Material", en: "Material" },
    cat_gasto_operativo: { es: "Gasto operativo", en: "Operational expense" },
    cat_ajuste: { es: "Ajuste", en: "Adjustment" },

    // KPIs de la ficha del contratista (arriba del estado de cuenta).
    kpi_balance: { es: "Saldo pendiente", en: "Outstanding balance" },
    kpi_billed: { es: "Total facturado", en: "Total billed" },
    kpi_projects: { es: "Proyectos realizados", en: "Projects completed" },
    kpi_projects_count: { es: "movimientos de proyecto", en: "project movements" },
    kpi_paid: { es: "Total pagado", en: "Total paid" },
    kpi_materials: { es: "Total en materiales", en: "Total in materials" },

    // Selector de período del estado de cuenta. Filtrar por período solo
    // cambia QUÉ filas se ven — el saldo corrido nunca se reinicia.
    period_label: { es: "Período", en: "Period" },
    period_month: { es: "Mes", en: "Month" },
    period_quarter: { es: "Trimestre", en: "Quarter" },
    period_semester: { es: "Semestre", en: "Semester" },
    period_year: { es: "Año", en: "Year" },
    period_last15: { es: "Últimos 15 movimientos", en: "Last 15 movements" },
    period_all: { es: "Todo", en: "All" },
    period_prev: { es: "Período anterior", en: "Previous period" },
    period_next: { es: "Período siguiente", en: "Next period" },
    period_empty: {
      es: "Sin movimientos en este período. El saldo mostrado arrastra todo lo anterior.",
      en: "No movements in this period. The balance shown still carries everything before it.",
    },

    // Filtros y agrupación del estado de cuenta. Conviven con las vistas
    // por período; filtrar/agrupar solo cambia QUÉ filas se ven — el saldo
    // corrido nunca se reinicia.
    filter_category: { es: "Categoría", en: "Category" },
    filter_category_all: { es: "Todas las categorías", en: "All categories" },
    filter_project: { es: "Proyecto", en: "Project" },
    filter_project_all: { es: "Todos los proyectos", en: "All projects" },
    filter_project_none: { es: "Sin proyecto", en: "No project" },
    group_by: { es: "Agrupar por", en: "Group by" },
    group_none: { es: "Sin agrupar", en: "No grouping" },
    group_category: { es: "Categoría", en: "Category" },
    group_project: { es: "Proyecto", en: "Project" },
    group_month: { es: "Mes", en: "Month" },
    group_subtotal: { es: "Subtotal del grupo", en: "Group subtotal" },
    col_project: { es: "Proyecto", en: "Project" },
    no_project: { es: "Sin proyecto", en: "No project" },

    // Total de lo que queda visible tras filtrar (distinto del saldo
    // corrido: esto es solo la suma del conjunto filtrado).
    filtered_total: { es: "Total filtrado", en: "Filtered total" },
    filtered_net: { es: "Neto", en: "Net" },
    filtered_count_one: { es: "movimiento", en: "movement" },
    filtered_count_many: { es: "movimientos", en: "movements" },

    // Menú de ajustes del contratista (engranaje en el encabezado): datos
    // personales + inactivar / liquidar / reactivar / eliminar.
    settings_menu: { es: "Ajustes del contratista", en: "Contractor settings" },
    details_title: { es: "Detalles", en: "Details" },

    // Fila de KPIs colapsable.
    kpis_title: { es: "Indicadores", en: "Key figures" },
    kpis_toggle_hint: { es: "Mostrar u ocultar los indicadores", en: "Show or hide the key figures" },

    // Interruptor de color de la tabla del estado de cuenta (persistido).
    palette_label: { es: "Colores", en: "Colors" },
    palette_full: { es: "A todo color", en: "Full color" },
    palette_sober: { es: "Sobria", en: "Sober" },
    palette_toggle_hint: {
      es: "Cambiar entre fila a todo color y vista sobria",
      en: "Switch between full-color rows and the sober view",
    },

    // Pestañas del módulo.
    tab_directory: { es: "Contratistas", en: "Contractors" },
    tab_projects: { es: "Proyectos", en: "Projects" },

    // Directorio — contratistas inactivos.
    no_longer_work: { es: "Ya no laboran", en: "No longer active" },
    inactive_badge: { es: "Inactivo", en: "Inactive" },

    // Proyectos (ficha simple).
    projects_title: { es: "Proyectos", en: "Projects" },
    projects_subtitle: {
      es: "Proyectos de Ebony a los que se enganchan los movimientos.",
      en: "Ebony projects that ledger movements link to.",
    },
    add_project: { es: "Agregar proyecto", en: "Add project" },
    proj_search_ph: { es: "Buscar por nombre o cliente…", en: "Search by name or client…" },
    proj_dlg_add_title: { es: "Agregar proyecto", en: "Add project" },
    proj_dlg_edit_title: { es: "Editar proyecto", en: "Edit project" },
    proj_f_name: { es: "Nombre del proyecto", en: "Project name" },
    proj_f_name_ph: { es: "Ej. Cocina Apto. Costa del Este", en: "e.g. Kitchen — Costa del Este apt." },
    proj_f_client: { es: "Cliente / diseñadora", en: "Client / designer" },
    proj_f_status: { es: "Estado", en: "Status" },
    proj_status_active: { es: "Activo", en: "Active" },
    proj_status_completed: { es: "Terminado", en: "Completed" },
    proj_f_notes: { es: "Notas", en: "Notes" },
    proj_name_required: { es: "El nombre es obligatorio.", en: "Name is required." },
    proj_col_name: { es: "Proyecto", en: "Project" },
    proj_col_client: { es: "Cliente", en: "Client" },
    proj_col_status: { es: "Estado", en: "Status" },
    projects_empty: {
      es: "Todavía no hay proyectos. Agrega el primero.",
      en: "No projects yet. Add the first one.",
    },
    proj_saved: { es: "Proyecto guardado", en: "Project saved" },
    proj_delete_title: { es: "Eliminar proyecto", en: "Delete project" },
    proj_delete_desc: {
      es: "Se elimina el proyecto de la lista.",
      en: "The project is removed from the list.",
    },
    proj_delete_keeps_moves: {
      es: "Los movimientos que lo tenían enganchado NO se borran: quedan sin proyecto.",
      en: "Movements linked to it are NOT deleted: they stay with no project.",
    },
    proj_delete_confirm: { es: "Eliminar proyecto", en: "Delete project" },
    proj_deleted: { es: "Proyecto eliminado", en: "Project deleted" },

    // Ficha de contrato del proyecto (Etapa 2-A). Todos opcionales.
    proj_contract_section: { es: "Contrato", en: "Contract" },
    proj_contract_hint: { es: "Todos los campos son opcionales.", en: "All fields are optional." },
    proj_contract_empty: { es: "Sin datos de contrato todavía.", en: "No contract details yet." },
    proj_f_scope: { es: "Alcance / qué incluye", en: "Scope / what's included" },
    proj_f_furniture_type: { es: "Tipo de mueble", en: "Furniture type" },
    proj_f_material_color: { es: "Color del material", en: "Material color" },
    proj_f_specs: { es: "Especificaciones", en: "Specifications" },
    proj_f_payment_terms: { es: "Acuerdo de pago", en: "Payment terms" },
    proj_f_total_mt2: { es: "m² totales", en: "Total m²" },

    // Movimiento — enganche a proyecto.
    mov_f_project: { es: "Proyecto", en: "Project" },
    mov_f_project_none: { es: "Sin proyecto", en: "No project" },
    mov_f_project_new: { es: "＋ Crear proyecto nuevo…", en: "＋ Create new project…" },
    mov_f_client_note: { es: "Cliente final / nota (opcional)", en: "End client / note (optional)" },

    // Estado / liquidación del contratista (en su ficha).
    status_section_title: { es: "Estado / Liquidación", en: "Status / Settlement" },
    status_label: { es: "Estado", en: "Status" },
    status_active: { es: "Activo", en: "Active" },
    status_inactive: { es: "Inactivo", en: "Inactive" },
    status_hint: {
      es: "Inactivar conserva toda la historia y el saldo del contratista; solo lo mueve a “Ya no laboran”.",
      en: "Deactivating keeps the contractor's full history and balance; it just moves them to “No longer active”.",
    },
    end_date_label: { es: "Fecha de salida", en: "End date" },
    liq_mark: { es: "Inactivar / liquidar", en: "Deactivate / settle" },
    liq_edit: { es: "Editar salida", en: "Edit exit" },
    reactivate: { es: "Reactivar", en: "Reactivate" },
    liq_dlg_title: { es: "Inactivar / liquidar contratista", en: "Deactivate / settle contractor" },
    liq_dlg_desc: {
      es: "Marca la salida del contratista: pasa a INACTIVO con fecha de salida y notas. La historia y el saldo se conservan.",
      en: "Mark the contractor's exit: set to INACTIVE with an end date and notes. History and balance are kept.",
    },
    liq_f_end_date: { es: "Fecha de salida", en: "End date" },
    liq_f_end_date_required: { es: "La fecha de salida es obligatoria.", en: "End date is required." },
    liq_f_notes: { es: "Notas de salida / liquidación", en: "Exit / settlement notes" },
    liq_balance_warning_title: { es: "Saldo pendiente", en: "Outstanding balance" },
    liq_balance_warning: {
      es: "Este contratista tiene un saldo distinto de cero. Inactivar NO salda la cuenta — registra primero el pago o el ajuste si corresponde.",
      en: "This contractor has a non-zero balance. Deactivating does NOT settle the account — record the payment or adjustment first if needed.",
    },
    liq_done: { es: "Contratista inactivado", en: "Contractor deactivated" },
    reactivate_done: { es: "Contratista reactivado", en: "Contractor reactivated" },

    // Zona de peligro — borrar contratista.
    danger_zone: { es: "Zona de peligro", en: "Danger zone" },
    danger_explain: {
      es: "Inactivar conserva. Borrar elimina al contratista y TODO su estado de cuenta, de forma irreversible.",
      en: "Deactivating keeps everything. Deleting removes the contractor and their ENTIRE account statement, irreversibly.",
    },
    delete_contractor: { es: "Eliminar contratista", en: "Delete contractor" },
    del_dlg_title: { es: "Eliminar contratista", en: "Delete contractor" },
    del_dlg_desc: {
      es: "Se elimina al contratista y todos sus movimientos. No se puede deshacer.",
      en: "The contractor and all their movements are deleted. This cannot be undone.",
    },
    del_warning: {
      es: "Esto borra el estado de cuenta completo. Si solo quieres cerrar la relación, usa “Inactivar / liquidar”.",
      en: "This erases the full account statement. To just close the relationship, use “Deactivate / settle”.",
    },
    del_type_name: { es: "Para confirmar, escribe el nombre exacto:", en: "To confirm, type the exact name:" },
    del_confirm: { es: "Eliminar para siempre", en: "Delete permanently" },
    del_done: { es: "Contratista eliminado", en: "Contractor deleted" },
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
