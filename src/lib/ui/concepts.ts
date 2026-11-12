import {
  Building2,
  CalendarDays,
  FileText,
  Folder,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
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
  /** "¿Para quién?": quiénes intervienen (arquitecto y/o cliente). */
  people: Users,
  firm: Building2,
  quote: FileText,
  opportunity: Waypoints,
  phone: Phone,
  email: Mail,
  location: MapPin,
  date: CalendarDays,
  notes: StickyNote,
  note: MessageSquare,
  files: Paperclip,
} satisfies Record<string, LucideIcon>;
