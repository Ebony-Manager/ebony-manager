import { strings } from "@/lib/i18n";
import type { AppModule } from "@/lib/auth/modules";

type Entry = { es: string; en: string };

/** Nombre y descripción de cada módulo en la pantalla de Usuarios. */
export const MODULE_LABELS: Record<AppModule, { label: Entry; hint: Entry }> = {
  cotizacion: { label: strings.usuarios.mod_cotizacion, hint: strings.usuarios.mod_cotizacion_hint },
  costos: { label: strings.usuarios.mod_costos, hint: strings.usuarios.mod_costos_hint },
  planilla: { label: strings.usuarios.mod_planilla, hint: strings.usuarios.mod_planilla_hint },
  asistencia: { label: strings.usuarios.mod_asistencia, hint: strings.usuarios.mod_asistencia_hint },
  contratistas: { label: strings.usuarios.mod_contratistas, hint: strings.usuarios.mod_contratistas_hint },
};
