// Propuesta de proveedores por producto, sacada de la pestaña "Proveedores"
// del Excel "Inventario General" (oct. 2026). Solo para la pantalla de
// revisión (/almacen/revision): no se guarda nada hasta que se apruebe.

export interface ProposedSupplier {
  key: string;
  name: string;
  contact: string | null;
  phone: string | null;
  note: string | null;
}

export const PROPOSED_SUPPLIERS: ProposedSupplier[] = [
  { key: "multicomercial", name: "Multicomercial", contact: null, phone: "6496-2300", note: null },
  { key: "centro", name: "Centro de Ofertas", contact: null, phone: "6324-6690", note: "También hace el mantenimiento de herramientas (servicio)." },
  { key: "novey", name: "Novey", contact: null, phone: null, note: "Se compra directo en la sede." },
  { key: "imeca", name: "Imeca", contact: null, phone: "6063-9411", note: null },
  { key: "dimosa", name: "Dimosa", contact: "Anellys", phone: "6248-4385", note: null },
  { key: "carbone", name: "Carbone", contact: null, phone: null, note: "Tienda en línea: carbonestore.com" },
  { key: "moby", name: "Moby", contact: "Klaudia", phone: "6849-3183", note: null },
  { key: "fdc", name: "FDC", contact: "Sara", phone: "6823-8406", note: null },
  { key: "enxamble", name: "Enxamble", contact: "Daniela", phone: "6814-2401", note: null },
  { key: "villalobos", name: "Auto Repuestos y Ferretería Villalobos", contact: null, phone: "6967-6398", note: null },
  { key: "colombia", name: "Colombia", contact: null, phone: null, note: "Así dice el Excel, sin contacto." },
  { key: "hopsa", name: "Hopsa", contact: "Ana Velásquez", phone: "6840-3874", note: null },
  { key: "lumicentro", name: "Lumicentro", contact: null, phone: null, note: "Sin contacto en el Excel." },
  { key: "mrled", name: "Mr. Led", contact: null, phone: "6201-2268", note: null },
  { key: "gigatech", name: "Gigatech", contact: null, phone: "6205-9485", note: null },
  { key: "abernathy", name: "Abernathy", contact: null, phone: "6830-8134", note: null },
];

export interface ItemProposal {
  primary: string;
  alternatives?: string[];
  /** Cómo aparece en el Excel. */
  excel: string;
  /** Algo que hay que confirmar. */
  doubt?: string;
}

const CARBONE_DOUBT =
  "En el Excel la celda de Carbone cubre 31 productos (de Marcadores a Punta estrella). ¿Todos se compran en Carbone o algunos son de Dimosa?";

/** Por nombre del producto en la app. */
export const ITEM_PROPOSALS: Record<string, ItemProposal> = {
  // Multicomercial
  "Ángulo metálico": { primary: "multicomercial", excel: "Angulo metalico" },
  Celulón: { primary: "multicomercial", excel: "Celulon" },
  "Soporte de tablilla flotante": { primary: "multicomercial", excel: "Soporte de tablilla flotante" },
  "Alcayata de metal": { primary: "multicomercial", excel: "Alcayata" },
  // Centro de Ofertas
  "Tornillo #6": { primary: "centro", excel: "Tornillo gypsum 6x1, 6x1-1/8 y 6x2", doubt: 'La medida 2-1/2" no aparece en el Excel.' },
  "Tornillo de pared": { primary: "centro", excel: "Tornillo azul", doubt: '¿El "tornillo azul" es el tornillo de pared?' },
  "Broca de pared": {
    primary: "carbone",
    alternatives: ["multicomercial", "centro"],
    excel: "Brocas pared (Carbone), Brocas 5/32 (Multicomercial), Brocas 1/4 concreto (Centro de Ofertas)",
    doubt: "Sale con tres proveedores según la medida. ¿Cuál es el principal?",
  },
  // Dimosa
  "Papel de embalaje": { primary: "dimosa", excel: "Papel blanco de embalar" },
  // Carbone
  "Plástico de embalaje": { primary: "carbone", excel: "Plastico para embalar", doubt: CARBONE_DOUBT },
  "Wiper (estopa)": { primary: "carbone", excel: "Estopa", doubt: CARBONE_DOUBT },
  "Cúter (exacto)": { primary: "carbone", excel: "Exacto", doubt: CARBONE_DOUBT },
  "Cuchilla para cúter": { primary: "carbone", excel: "Repuesto exacto", doubt: CARBONE_DOUBT },
  'Disco de corte 6-1/2"': { primary: "carbone", excel: "Discos de corte", doubt: CARBONE_DOUBT },
  "Disco de corte para metal": { primary: "carbone", excel: "Discos de corte", doubt: CARBONE_DOUBT },
  "Hoja de segueta": { primary: "carbone", excel: "Hojas de zegueta", doubt: CARBONE_DOUBT },
  "Hoja de caladora": { primary: "carbone", excel: "Cuchillas caladora", doubt: CARBONE_DOUBT },
  "Tape transparente": { primary: "carbone", excel: "Tape transparente", doubt: CARBONE_DOUBT },
  Thinner: { primary: "carbone", excel: "Thinner", doubt: CARBONE_DOUBT },
  "Saco de polipropileno": { primary: "carbone", excel: "Saco caliche", doubt: CARBONE_DOUBT },
  "Paño de microfibra": { primary: "carbone", excel: "Paños de microfibra", doubt: CARBONE_DOUBT },
  "Lija en pliego": { primary: "carbone", excel: "Lijas", doubt: CARBONE_DOUBT },
  "Lija en rollo": { primary: "carbone", excel: "Lijas", doubt: CARBONE_DOUBT },
  Lápiz: { primary: "carbone", excel: "Lapiz", doubt: CARBONE_DOUBT },
  Limpiavidrios: { primary: "carbone", excel: "Limpia vidrios", doubt: CARBONE_DOUBT },
  "WD-40": { primary: "carbone", excel: "WD-40", doubt: CARBONE_DOUBT },
  "High Tack": { primary: "carbone", excel: "High Tack", doubt: CARBONE_DOUBT },
  "Bolsa de basura": { primary: "carbone", excel: "Bolsa de basura", doubt: CARBONE_DOUBT },
  Aguarrás: { primary: "carbone", excel: "Aguarras", doubt: CARBONE_DOUBT },
  Tomacorriente: { primary: "carbone", excel: "Tomacorriente / Tomacorriente polarizado hembra y macho", doubt: CARBONE_DOUBT },
  "Enchufe polarizado (macho)": { primary: "carbone", excel: "Tomacorriente polarizado hembra y macho", doubt: CARBONE_DOUBT },
  "Conector eléctrico": { primary: "carbone", excel: "Conectores electricos", doubt: CARBONE_DOUBT },
  Estaño: { primary: "carbone", excel: "Estaño", doubt: CARBONE_DOUBT },
  "Tape eléctrico negro": { primary: "carbone", excel: "Tape negro electrico", doubt: CARBONE_DOUBT },
  "Grapa para pistola": { primary: "carbone", excel: "Grapa Pistola", doubt: CARBONE_DOUBT },
  "Clavo para pistola (clavillo)": { primary: "carbone", excel: "Clavillo pistola", doubt: CARBONE_DOUBT },
  "Punta de destornillador estrella": { primary: "carbone", excel: "Punta estrella", doubt: CARBONE_DOUBT },
  // Moby
  Deslizador: { primary: "moby", excel: "Deslizadores" },
  Pasacables: { primary: "moby", excel: "Pasa cables" },
  "Riel de gaveta": {
    primary: "moby",
    alternatives: ["hopsa"],
    excel: "Riel telescópico y riel oculto Salice cierre lento (Moby); Riel cierre suave de 30 (Hopsa)",
    doubt: 'Imeca tiene un "Riel escondido 23 cm" que no está entre las medidas de la app. ¿Se agrega esa medida?',
  },
  "Bisagra curva": { primary: "moby", excel: "Bisagra curva" },
  "Bisagra semicurva": { primary: "moby", excel: "Bisagra Semicurva" },
  "Bisagra recta Salice": { primary: "moby", excel: "Bisagra Recta Salice" },
  "Bisagra cangrejo": { primary: "moby", excel: "Bisagra tipo cangrejo" },
  "Soporte de tablilla de closet": { primary: "moby", excel: "Soporte tablilla" },
  'Tornillo #8 x 5/8" (bisagra)': { primary: "moby", excel: "Tornillos 5/8 para bisagra" },
  "Riel Shelf": { primary: "moby", excel: "Riel Shelf" },
  "Pata niveladora plástica": { primary: "moby", excel: "Pata Niveladora" },
  "Soporte de tubo de closet": { primary: "moby", alternatives: ["fdc"], excel: "Soporte tubo lateral (está en Moby y en FDC)" },
  "Lámina MDF": { primary: "moby", excel: "Lamina Mdf" },
  "Perfil gola": { primary: "moby", excel: "Gola L y Gola C" },
  "Galleta (para engalletar)": { primary: "moby", excel: "Galleta" },
  "Soporte de tablilla de vidrio": { primary: "moby", excel: "Soporte tablilla de vidrio" },
  // FDC
  "Brazo mecánico": { primary: "fdc", excel: "Brazo mecanico" },
  "Perfil para cinta LED": { primary: "fdc", excel: "Perfil cinta led" },
  Burlete: { primary: "fdc", excel: "Burlete" },
  // Enxamble
  "Pegamento Kit Express": { primary: "enxamble", excel: "Pegadit express Duo", doubt: '¿"Pegadit express Duo" es el Kit Express?' },
  "Pegamento Fortik": { primary: "enxamble", excel: "Cemento PL o Fortik" },
  "Expulsor (push)": { primary: "enxamble", excel: "Push open" },
  "Pegamento Carpincol": { primary: "enxamble", excel: "Carpincol Plus" },
  "Pegamento granulado para canteadora": { primary: "enxamble", excel: "Pegamento granulado transparente canteadora" },
  "Pegamento PU": { primary: "enxamble", excel: "PU" },
  // Villalobos
  'Tape naranja 1"': { primary: "villalobos", excel: "Tape naranja" },
  // Colombia
  Avellanador: { primary: "colombia", excel: "Avellanador" },
  "Fresa para router": { primary: "colombia", excel: "Fresas para Router" },
  // Luces
  "Cinta LED": {
    primary: "lumicentro",
    alternatives: ["gigatech"],
    excel: "Caja cinta led 3000k (Lumicentro); Rollo cable RGB (Gigatech)",
    doubt: '¿El "Rollo cable RGB" de Gigatech es la cinta LED RGB o un cable aparte?',
  },
  Interruptor: { primary: "mrled", excel: "Interruptor" },
  "Conector para LED": { primary: "mrled", excel: "Conector para led" },
  "Transformador LED": { primary: "mrled", excel: "Transformador led" },
  Termoencogible: { primary: "gigatech", excel: "Termoencogible" },
  "Cable dúplex calibre 16": { primary: "gigatech", excel: "Cable calibre 16 duplex" },
  "Cable calibre 14 AWG": { primary: "gigatech", excel: "Cable electrico calibre 14 AWG" },
  // Abernathy
  "Pegamento epóxico Duo": { primary: "abernathy", excel: "Duo epoxica" },
};

/** Lo que está en el Excel de proveedores pero no es un producto del almacén. */
export const EXCEL_ONLY: { name: string; supplier: string; note?: string }[] = [
  { name: "Bisagra mariposa", supplier: "multicomercial" },
  { name: "Crema de soldar", supplier: "multicomercial" },
  { name: "Broca punta de diamante", supplier: "centro" },
  { name: "Mantenimiento de herramientas", supplier: "centro", note: "Es un servicio, no un producto." },
  { name: "Masilla", supplier: "novey" },
  { name: "Plantilla para tornillos y bisagras", supplier: "imeca", note: "Parece herramienta (Etapa 2)." },
  { name: "Riel escondido 23 cm", supplier: "imeca", note: "Medida que no está en Riel de gaveta." },
  { name: "Marcadores", supplier: "carbone" },
  { name: "Platina", supplier: "carbone" },
  { name: "Pilas", supplier: "carbone" },
];

/** En el Excel, pero ya se eliminaron de la app. */
export const EXCEL_DELETED = ["Teflón", "Bisagra omega", "Bisagra recta Blum"];
