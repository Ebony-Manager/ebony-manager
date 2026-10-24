// Propuesta de proveedores por producto, sacada de la pestaña "Proveedores"
// del Excel "Inventario General" (oct. 2026). Solo para la pantalla de
// revisión (/almacen/revision): no se guarda nada hasta que se apruebe.

export interface ProposedSupplier {
  key: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email?: string;
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
  {
    key: "euroferr",
    name: "Ferretería Euroferr",
    contact: null,
    phone: "+57 312 540 4477",
    email: "ferreteriaeuroferr@gmail.com",
    note: 'En Colombia. En el Excel decía "Colombia".',
  },
  { key: "hopsa", name: "Hopsa", contact: "Ana Velásquez", phone: "6840-3874", note: null },
  { key: "lumicentro", name: "Lumicentro", contact: null, phone: null, note: "Sin contacto en el Excel." },
  { key: "mrled", name: "Mr. Led", contact: null, phone: "6201-2268", note: null },
  { key: "gigatech", name: "Gigatech", contact: null, phone: "6205-9485", note: null },
  { key: "abernathy", name: "Abernathy", contact: null, phone: "6830-8134", note: null },
  { key: "amazon", name: "Amazon", contact: null, phone: null, note: "Compra en línea (falta el enlace del producto)." },
  { key: "madex", name: "Madex", contact: null, phone: null, note: "Sin contacto todavía." },
  { key: "yalis", name: "GuangDong YALIS Intelligent Technology Co., LTD", contact: null, phone: null, note: "China (importación). Sin contacto todavía." },
];

export interface ItemProposal {
  primary: string;
  alternatives?: string[];
  /** Cómo aparece en el Excel. */
  excel: string;
  /** Dato confirmado que conviene ver al revisar. */
  note?: string;
  /** Algo que hay que confirmar. */
  doubt?: string;
}

/** Por nombre del producto en la app. */
export const ITEM_PROPOSALS: Record<string, ItemProposal> = {
  // Multicomercial
  "Ángulo metálico": { primary: "multicomercial", excel: "Angulo metalico" },
  Celulón: { primary: "multicomercial", excel: "Celulon" },
  "Soporte de tablilla flotante": { primary: "multicomercial", excel: "Soporte de tablilla flotante" },
  "Alcayata de metal": { primary: "multicomercial", excel: "Alcayata" },
  // Centro de Ofertas
  "Tornillo #6": { primary: "centro", excel: "Tornillo gypsum 6x1, 6x1-1/8 y 6x2" },
  "Tornillo de pared": { primary: "centro", alternatives: ["multicomercial"], excel: "Tornillo azul" },
  "Broca de pared": {
    primary: "carbone",
    alternatives: ["multicomercial", "centro"],
    excel: "Brocas pared (Carbone), Brocas 5/32 (Multicomercial), Brocas 1/4 concreto (Centro de Ofertas)",
    note: "Cada uno vende solo algunas medidas: 5/32 en Multicomercial, 1/4 de concreto en Centro de Ofertas, el resto en Carbone.",
  },
  // Dimosa
  "Papel de embalaje": { primary: "dimosa", excel: "Papel blanco de embalar" },
  // Carbone
  "Plástico de embalaje": { primary: "carbone", excel: "Plastico para embalar" },
  "Wiper (estopa)": { primary: "carbone", excel: "Estopa" },
  "Cúter (exacto)": { primary: "carbone", excel: "Exacto" },
  "Cuchilla para cúter": { primary: "carbone", excel: "Repuesto exacto" },
  'Disco de corte 6-1/2"': { primary: "carbone", excel: "Discos de corte" },
  "Disco de corte para metal": { primary: "carbone", excel: "Discos de corte" },
  "Hoja de segueta": { primary: "carbone", excel: "Hojas de zegueta" },
  "Hoja de caladora": { primary: "carbone", excel: "Cuchillas caladora" },
  "Tape transparente": { primary: "carbone", excel: "Tape transparente" },
  Thinner: { primary: "carbone", excel: "Thinner" },
  "Saco de polipropileno": { primary: "carbone", excel: "Saco caliche" },
  "Paño de microfibra": { primary: "carbone", excel: "Paños de microfibra" },
  "Lija en pliego": { primary: "carbone", excel: "Lijas" },
  "Lija en rollo": { primary: "carbone", excel: "Lijas" },
  Lápiz: { primary: "carbone", excel: "Lapiz" },
  Limpiavidrios: { primary: "carbone", excel: "Limpia vidrios" },
  "WD-40": { primary: "carbone", excel: "WD-40" },
  "High Tack": { primary: "carbone", excel: "High Tack" },
  "Bolsa de basura": { primary: "carbone", excel: "Bolsa de basura" },
  Aguarrás: { primary: "carbone", excel: "Aguarras" },
  Tomacorriente: { primary: "carbone", excel: "Tomacorriente / Tomacorriente polarizado hembra y macho" },
  "Enchufe polarizado (macho)": { primary: "carbone", excel: "Tomacorriente polarizado hembra y macho" },
  "Conector eléctrico": { primary: "carbone", excel: "Conectores electricos" },
  Estaño: { primary: "carbone", excel: "Estaño" },
  "Tape eléctrico negro": { primary: "carbone", excel: "Tape negro electrico" },
  "Grapa para pistola": { primary: "carbone", excel: "Grapa Pistola" },
  "Clavo para pistola (clavillo)": { primary: "carbone", excel: "Clavillo pistola" },
  "Punta de destornillador estrella": { primary: "carbone", excel: "Punta estrella" },
  // Moby
  Deslizador: { primary: "moby", excel: "Deslizadores" },
  Pasacables: { primary: "moby", excel: "Pasa cables" },
  "Riel de gaveta": {
    primary: "moby",
    excel: "Riel telescópico y riel oculto Salice cierre lento (Moby); Riel cierre suave de 30 (Hopsa)",
    alternatives: ["hopsa", "imeca"],
    note: "Medida nueva: 23 cm cierre suave oculto (el riel escondido de Imeca).",
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
  "Pegamento Kit Express": { primary: "enxamble", excel: "Pegadit express Duo" },
  "Pegamento Fortik": { primary: "enxamble", excel: "Cemento PL o Fortik" },
  "Expulsor (push)": { primary: "enxamble", excel: "Push open" },
  "Pegamento Carpincol": { primary: "enxamble", excel: "Carpincol Plus" },
  "Pegamento granulado para canteadora": { primary: "enxamble", excel: "Pegamento granulado transparente canteadora" },
  "Pegamento PU": { primary: "enxamble", excel: "PU" },
  // Villalobos
  'Tape naranja 1"': { primary: "villalobos", excel: "Tape naranja" },
  // Colombia
  Avellanador: { primary: "euroferr", excel: "Avellanador" },
  "Fresa para router": { primary: "euroferr", excel: "Fresas para Router" },
  // Luces
  "Cinta LED rollo 5 m": { primary: "lumicentro", excel: "Caja cinta led 3000k", note: "Paquete con 1 rollo de 5 m; se cuenta por rollo." },
  Interruptor: { primary: "mrled", excel: "Interruptor" },
  "Conector para LED": { primary: "mrled", excel: "Conector para led" },
  "Transformador LED": { primary: "mrled", excel: "Transformador led" },
  Termoencogible: { primary: "gigatech", excel: "Termoencogible" },
  "Cable dúplex calibre 16": { primary: "gigatech", excel: "Cable calibre 16 duplex" },
  "Cable calibre 14 AWG": { primary: "gigatech", excel: "Cable electrico calibre 14 AWG" },
  // Respondidos por Ebony (no estaban en el Excel)
  "Broca para madera": { primary: "multicomercial", excel: "—" },
  "Disco para engalletadora": {
    primary: "amazon",
    excel: "—",
    note: '100 mm / 4" Carbide Biscuit. Amazon: https://www.amazon.com/dp/B08BZ3Z8K9',
  },
  "Disco para melamina": { primary: "carbone", excel: "—" },
  "Sensor de luz": { primary: "mrled", excel: "—" },
  "Canto chapilla": { primary: "moby", alternatives: ["fdc"], excel: "—" },
  "Canto melamina gris coco": { primary: "moby", excel: "—" },
  "Canto pintable": { primary: "enxamble", alternatives: ["madex"], excel: "—" },
  "Bisagra oculta": { primary: "yalis", excel: "—", note: "Dos modelos, los dos negros: YLS-033 sin resorte (regular) y YS-2D con resorte." },
  "Tubo de closet": { primary: "moby", alternatives: ["fdc", "enxamble"], excel: "—" },
  // Abernathy
  "Pegamento epóxico Duo": { primary: "abernathy", excel: "Duo epoxica" },
};

/** Productos nuevos que se agregan al catálogo (pedidos por Ebony). Sin foto ni mínimo todavía. */
export interface NewProduct {
  name: string;
  category: string;
  unit: string;
  /** "" = todavía no se sabe. */
  primary: string;
  alternatives?: string[];
  note?: string;
  /** Variantes con las que se crea (sin esto, variante única). */
  variants?: string[];
  doubt?: string;
}

export const NEW_PRODUCTS: NewProduct[] = [
  { name: "Masilla", category: "Pintura y sellantes", unit: "unidad", primary: "novey", doubt: "¿Se compra por galón, cuarto o tubo?" },
  { name: "Pilas", category: "Eléctrico", unit: "unidad", primary: "carbone", alternatives: ["novey"], variants: ["AA", "AAA"] },
  { name: "Platina", category: "Soportes y perfiles", unit: "unidad", primary: "carbone" },
  { name: "Crema de soldar", category: "Eléctrico", unit: "unidad", primary: "multicomercial" },
  { name: "Bisagra mariposa", category: "Herrajería", unit: "unidad", primary: "multicomercial", doubt: "¿Qué tamaños?" },
  {
    name: "Broca punta de diamante",
    category: "Brocas y cuchillas",
    unit: "unidad",
    primary: "centro",
    doubt: "¿Qué medidas? ¿Se presta y se devuelve como la broca de pared?",
  },
  {
    name: "Manigueta",
    category: "Herrajería",
    unit: "unidad",
    primary: "yalis",
    variants: ["B262Y-C negra"],
  },
  { name: "Cable RGB", category: "Eléctrico", unit: "metro", primary: "gigatech", note: "Rollo de cable RGB (no es la cinta)." },
  {
    name: "Cinta LED rollo 100 m",
    category: "Eléctrico",
    unit: "metro",
    primary: "",
    note: "Vienen de China: rollos de 100 m, se cuentan por metro. Hay 5 rollos pedidos.",
    doubt: "¿De qué color (3000K, 6500K)? ¿El proveedor es YALIS u otro?",
  },
];

/** En el Excel, pero ya se eliminaron de la app. */
export const EXCEL_DELETED = ["Teflón", "Bisagra omega", "Bisagra recta Blum"];
