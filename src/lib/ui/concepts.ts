import {
  Building2,
  CalendarDays,
  FileText,
  Folder,
  Hash,
  House,
  Mail,
  MapPin,
  MessageSquare,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  List,
  PenLine,
  Factory,
  Package,
  PaintBucket,
  Paperclip,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
  TrendingDown,
  Warehouse,
  Palette,
  Phone,
  StickyNote,
  User,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

/**
 * Un concepto, un ícono (ver UI-RULES.md): el mismo en el menú, en los
 * campos, en los grupos y en las listas. Para un campo, `<Field icon={ICON.owner}>`.
 * Si un concepto no está acá, el campo no lleva ícono; si va a repetirse, se
 * agrega acá primero (y la prueba src/ui-consistency.test.ts evita variantes).
 */
export const ICON = {
  project: Folder,
  client: User,
  /** Persona que se encarga de algo (responsable, quien recibe…). */
  owner: User,
  /** Diseñadora de Ebony asignada a un proyecto u oportunidad. */
  designer: Palette,
  /** Movimientos del inventario: lo que sale, lo que entra y lo que se ajusta. */
  moveOut: ArrowUpFromLine,
  moveIn: ArrowDownToLine,
  adjust: SlidersHorizontal,
  /** Filtro «Todos». */
  all: List,
  /** Resumen de Almacén: consumo, existencias, compras. */
  consumption: TrendingDown,
  stock: Boxes,
  purchases: ShoppingCart,
  /** Período de un resumen. */
  period: CalendarDays,
  /** Solicitud automática (llegó al mínimo) y escrita a mano. */
  auto: RefreshCw,
  /** Pedir del catálogo / escribir lo que hace falta. */
  catalog: Boxes,
  freeText: PenLine,
  /** Uso interno (taller, embalaje, pintura). */
  internal: Warehouse,
  taller: Factory,
  embalaje: Package,
  pintura: PaintBucket,
  /** "¿Para quién?": quiénes intervienen (arquitecto y/o cliente). */
  people: Users,
  firm: Building2,
  quote: FileText,
  opportunity: Waypoints,
  phone: Phone,
  email: Mail,
  location: MapPin,
  /** Edificio o casa. */
  building: House,
  /** Número de apartamento. */
  unit: Hash,
  date: CalendarDays,
  notes: StickyNote,
  note: MessageSquare,
  files: Paperclip,
} satisfies Record<string, LucideIcon>;
