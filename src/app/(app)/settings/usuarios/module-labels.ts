import { strings } from "@/lib/i18n";
import type { AppModule } from "@/lib/auth/modules";

type Entry = { es: string; en: string };

/** Nombre y descripción de cada módulo en la pantalla de Usuarios. */
export const MODULE_LABELS: Record<AppModule, { label: Entry; hint: Entry }> = {
  cotizacion: { label: strings.usuarios.mod_cotizacion, hint: strings.usuarios.mod_cotizacion_hint },
  costos: { label: strings.usuarios.mod_costos, hint: strings.usuarios.mod_costos_hint },
  proyectos: { label: strings.usuarios.mod_proyectos, hint: strings.usuarios.mod_proyectos_hint },
  planilla: { label: strings.usuarios.mod_planilla, hint: strings.usuarios.mod_planilla_hint },
  asistencia: { label: strings.usuarios.mod_asistencia, hint: strings.usuarios.mod_asistencia_hint },
  contratistas: { label: strings.usuarios.mod_contratistas, hint: strings.usuarios.mod_contratistas_hint },
  documentos: { label: strings.usuarios.mod_documentos, hint: strings.usuarios.mod_documentos_hint },
  almacen: { label: strings.usuarios.mod_almacen, hint: strings.usuarios.mod_almacen_hint },
  almacen_compras: { label: strings.usuarios.mod_almacen_compras, hint: strings.usuarios.mod_almacen_compras_hint },
  almacen_costos: { label: strings.usuarios.mod_almacen_costos, hint: strings.usuarios.mod_almacen_costos_hint },
  almacen_ajustes: { label: strings.usuarios.mod_almacen_ajustes, hint: strings.usuarios.mod_almacen_ajustes_hint },
};
