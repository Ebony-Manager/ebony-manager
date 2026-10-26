import { PaintBucket, Package, type LucideIcon } from "lucide-react";
import { strings } from "@/lib/i18n";
import { hasAnyModule, type AccessSubject, type AppModule } from "@/lib/auth/modules";

/**
 * Accesos rápidos a formularios de afuera (JotForm): botones en «Más» (celular)
 * y en el menú de perfil (computadora), sin crear pantallas. Cada uno se ve
 * según permiso; abren en otra pestaña.
 */
export interface QuickLink {
  key: string;
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
  /** Alcanza con uno de estos permisos (el admin los ve todos). */
  anyModules: AppModule[];
}

export const QUICK_LINKS: QuickLink[] = [
  // Jefa de taller: autorizaciones (formularios firmados en JotForm).
  { key: "auth-pintura", href: "https://form.jotform.com/251893102532149", icon: PaintBucket, label: strings.nav.form_pintura, anyModules: ["asistencia"] },
  { key: "auth-embalaje", href: "https://form.jotform.com/252224493029859", icon: Package, label: strings.nav.form_embalaje, anyModules: ["asistencia"] },
];

export const visibleQuickLinks = (subject: AccessSubject | null | undefined) => QUICK_LINKS.filter((l) => hasAnyModule(subject, l.anyModules));
