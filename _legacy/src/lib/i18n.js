// Bilingual strings — ES (primary) / EN (secondary)
export const strings = {
  // Navigation
  nav: {
    cotizacion:  { es: 'Cotización',        en: 'Quote' },
    proyectos:   { es: 'Proyectos',         en: 'Projects' },
    cronograma:  { es: 'Cronograma',        en: 'Schedule' },
    gastos:      { es: 'Gastos',            en: 'Expenses' },
    dashboard:   { es: 'Dashboard',         en: 'Dashboard' },
  },

  // Common
  common: {
    save:       { es: 'Guardar',    en: 'Save' },
    cancel:     { es: 'Cancelar',  en: 'Cancel' },
    delete:     { es: 'Eliminar',  en: 'Delete' },
    edit:       { es: 'Editar',    en: 'Edit' },
    add:        { es: 'Agregar',   en: 'Add' },
    loading:    { es: 'Cargando…', en: 'Loading…' },
    error:      { es: 'Error',     en: 'Error' },
    success:    { es: 'Éxito',     en: 'Success' },
    confirm:    { es: 'Confirmar', en: 'Confirm' },
    close:      { es: 'Cerrar',    en: 'Close' },
    search:     { es: 'Buscar',    en: 'Search' },
    noData:     { es: 'Sin datos', en: 'No data' },
    optional:   { es: 'opcional',  en: 'optional' },
    total:      { es: 'Total',     en: 'Total' },
    subtotal:   { es: 'Subtotal',  en: 'Subtotal' },
    discount:   { es: 'Descuento', en: 'Discount' },
  },

  // Auth
  auth: {
    signIn:     { es: 'Iniciar sesión con Google', en: 'Sign in with Google' },
    signOut:    { es: 'Cerrar sesión',             en: 'Sign out' },
    welcome:    { es: 'Bienvenido a Ebony Manager', en: 'Welcome to Ebony Manager' },
    subtitle:   { es: 'Sistema de gestión para Ebony Custom Woodwork', en: 'Management system for Ebony Custom Woodwork' },
  },

  // Cotización
  quote: {
    title:           { es: 'Nueva Cotización',       en: 'New Quote' },
    list:            { es: 'Cotizaciones',            en: 'Quotes' },
    client:          { es: 'Cliente',                 en: 'Client' },
    designer:        { es: 'Diseñadora',              en: 'Designer' },
    date:            { es: 'Fecha',                   en: 'Date' },
    validDays:       { es: 'Validez (días)',           en: 'Valid (days)' },
    margin:          { es: 'Margen de utilidad %',    en: 'Profit margin %' },
    marginHelp:      { es: 'Aplica a todos los ítems de la cotización', en: 'Applied to all items in the quote' },
    status:          { es: 'Estado',                  en: 'Status' },
    notes:           { es: 'Notas',                   en: 'Notes' },
    items:           { es: 'Ítems de la cotización',  en: 'Quote items' },
    addItem:         { es: 'Agregar ítem catálogo',   en: 'Add catalog item' },
    addCustom:       { es: 'Agregar ítem personalizado', en: 'Add custom item' },
    uploadPlan:      { es: 'Subir Plano',             en: 'Upload Plan' },
    exportPdf:       { es: 'Exportar PDF',            en: 'Export PDF' },
    saveQuote:       { es: 'Guardar Cotización',      en: 'Save Quote' },
    summary:         { es: 'Resumen',                 en: 'Summary' },
    category:        { es: 'Categoría',               en: 'Category' },
    subcategory:     { es: 'Subcategoría',            en: 'Subcategory' },
    material:        { es: 'Material',                en: 'Material' },
    unit:            { es: 'Unidad',                  en: 'Unit' },
    qty:             { es: 'Cantidad',                en: 'Qty' },
    costPerUnit:     { es: 'Costo base / unidad',     en: 'Base cost / unit' },
    salePrice:       { es: 'Precio venta / unidad',   en: 'Sale price / unit' },
    lineTotal:       { es: 'Total línea',             en: 'Line total' },
    globalDiscount:  { es: 'Descuento global %',      en: 'Global discount %' },
    finalTotal:      { es: 'Total final',             en: 'Final total' },
    itemName:        { es: 'Nombre del ítem',         en: 'Item name' },
    customCost:      { es: 'Costo base (USD)',         en: 'Base cost (USD)' },
    statuses: {
      Borrador:   { es: 'Borrador',   en: 'Draft' },
      Enviada:    { es: 'Enviada',    en: 'Sent' },
      Aprobada:   { es: 'Aprobada',  en: 'Approved' },
      Rechazada:  { es: 'Rechazada', en: 'Rejected' },
    },
  },

  // Plan extractor
  plan: {
    upload:          { es: 'Subir Plano Arquitectónico', en: 'Upload Architectural Plan' },
    uploadHint:      { es: 'PDF o imagen (JPG, PNG). Máx. 10MB.', en: 'PDF or image (JPG, PNG). Max 10MB.' },
    analyzing:       { es: 'Analizando plano con IA…', en: 'Analyzing plan with AI…' },
    reviewTitle:     { es: 'Ítems extraídos — Revisar antes de agregar', en: 'Extracted items — Review before adding' },
    confidence:      { es: 'Confianza', en: 'Confidence' },
    addAll:          { es: 'Agregar todos',    en: 'Add all' },
    addSelected:     { es: 'Agregar seleccionados', en: 'Add selected' },
    highConf:        { es: 'Alta',   en: 'High' },
    medConf:         { es: 'Media',  en: 'Medium' },
    lowConf:         { es: 'Baja',   en: 'Low' },
    lowConfWarn:     { es: 'Verificar dimensiones', en: 'Verify dimensions' },
    noItems:         { es: 'No se encontraron ítems en el plano. Ingresa manualmente.', en: 'No items found in plan. Enter manually.' },
    error:           { es: 'Error al analizar el plano. Intenta nuevamente.', en: 'Error analyzing plan. Try again.' },
  },
}

/**
 * Get a string in the current language.
 * Usage: t(lang, strings.quote.title)
 */
export function t(lang, entry) {
  if (!entry) return ''
  return entry[lang] ?? entry.es ?? ''
}
