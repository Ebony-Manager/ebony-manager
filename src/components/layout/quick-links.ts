import { PaintBucket, Package, UserPlus, type LucideIcon } from "lucide-react";
import { strings } from "@/lib/i18n";
import { hasExplicitModule, type AccessSubject, type AppModule } from "@/lib/auth/modules";

/**
 * Accesos rápidos a formularios de JotForm: botones en «Más» (celular) y en
 * el menú de perfil (computadora), sin crear pantallas. Cada uno pide su
 * permiso (grupo «Accesos rápidos» en Settings → Usuarios; a elección, ni el
 * admin los tiene si no se los marcan). `open` abre el
 * formulario; `share` manda el enlace (menú de compartir del teléfono, o
 * copiarlo si no hay).
 */
export interface QuickLink {
  key: string;
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
  module: AppModule;
  action: "open" | "share";
}

export const QUICK_LINKS: QuickLink[] = [
  // Jefa de taller: autorizaciones (formularios firmados en JotForm).
  { key: "auth-pintura", href: "https://form.jotform.com/251893102532149", icon: PaintBucket, label: strings.nav.form_pintura, module: "form_autorizaciones", action: "open" },
  { key: "auth-embalaje", href: "https://form.jotform.com/252224493029859", icon: Package, label: strings.nav.form_embalaje, module: "form_autorizaciones", action: "open" },
  // «Registro Empleado»: llega a Personal → Nuevos registros (webhook).
  { key: "registro", href: "https://form.jotform.com/232606019835052", icon: UserPlus, label: strings.nav.form_registro, module: "form_registro", action: "share" },
];

// Solo a quien lo tiene marcado, también el admin (no los recibe por ser admin).
export const visibleQuickLinks = (subject: AccessSubject | null | undefined) => QUICK_LINKS.filter((l) => hasExplicitModule(subject, l.module));

/** Compartir el enlace: menú del teléfono (WhatsApp…) o, si no hay, copiarlo. Devuelve "copied" si lo copió. */
export async function shareLink(url: string, text: string, title: string): Promise<"shared" | "copied" | "cancelled"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return "copied";
}
