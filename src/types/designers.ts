/** Una diseñadora de Ebony asignada a un proyecto (persona de Personal). */
export interface ProjectDesigner {
  employeeId: string;
  name: string;
  position: string | null;
  /** false = ya no trabaja (inactiva en Personal). */
  active: boolean;
  /** Si ya tiene acceso a la app (es usuaria). */
  hasAccess: boolean;
}

/** A quién se puede asignar a un proyecto (gente activa de Personal; sin sueldos ni datos de planilla). */
export interface DesignerCandidate {
  id: string;
  name: string;
  position: string | null;
  hasAccess: boolean;
}

/** Una cotización del proyecto, tal como la ve una diseñadora: sin ningún monto. */
export interface DesignerQuoteSummary {
  id: string;
  number: string;
  status: string;
  quoteDate: string;
  clientName: string;
  designerName: string;
  projectName: string;
  items: number;
}

export interface DesignerQuoteLine {
  id: string;
  name: string;
  category: string | null;
  finish: string | null;
  unit: string | null;
  shape: string | null;
  mode: string | null;
  width: number | null;
  height: number | null;
  pieces: number | null;
  qty: number | null;
  wall: string | null;
}

export interface DesignerQuoteSection {
  id: string;
  sortOrder: number;
  location: string | null;
  name: string | null;
  kind: string | null;
  description: string | null;
  qty: number;
  lines: DesignerQuoteLine[];
  /** Rutas en el bucket quote-images. */
  images: string[];
}

/** Una cotización completa SIN precios, márgenes, costos, totales, ITBMS ni descuentos (los quita la base de datos). */
export interface DesignerQuote {
  id: string;
  number: string;
  status: string;
  quoteDate: string | null;
  deliveryDays: number | null;
  lang: string | null;
  clientName: string;
  designerName: string;
  projectName: string;
  projectId: string | null;
  sections: DesignerQuoteSection[];
}
