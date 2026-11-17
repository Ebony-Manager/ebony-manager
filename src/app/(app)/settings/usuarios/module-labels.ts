import {
  BadgeDollarSign,
  BookUser,
  CalendarCheck,
  ClipboardCheck,
  FileCheck,
  Folder,
  Handshake,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { strings } from "@/lib/i18n";
import type { AppModule } from "@/lib/auth/modules";
import { ICON } from "@/lib/ui/concepts";

type Entry = { es: string; en: string };

/**
 * Nombre, descripción e ícono de cada módulo en la pantalla de Usuarios. El ícono es el del menú
 * principal (un concepto, un ícono: ver UI-RULES.md); los sub-permisos sin entrada propia en el menú usan
 * el de su concepto (Costos = dinero, Ajustes = ajustar, Contratistas = contrato…).
 */
export const MODULE_LABELS: Record<AppModule, { label: Entry; hint: Entry; icon: LucideIcon }> = {
  cotizacion: { label: strings.usuarios.mod_cotizacion, hint: strings.usuarios.mod_cotizacion_hint, icon: Handshake },
  costos: { label: strings.usuarios.mod_costos, hint: strings.usuarios.mod_costos_hint, icon: BadgeDollarSign },
  proyectos: { label: strings.usuarios.mod_proyectos, hint: strings.usuarios.mod_proyectos_hint, icon: Folder },
  planilla: { label: strings.usuarios.mod_planilla, hint: strings.usuarios.mod_planilla_hint, icon: Wallet },
  asistencia: { label: strings.usuarios.mod_asistencia, hint: strings.usuarios.mod_asistencia_hint, icon: CalendarCheck },
  contratistas: { label: strings.usuarios.mod_contratistas, hint: strings.usuarios.mod_contratistas_hint, icon: ICON.contract },
  documentos: { label: strings.usuarios.mod_documentos, hint: strings.usuarios.mod_documentos_hint, icon: Users },
  almacen: { label: strings.usuarios.mod_almacen, hint: strings.usuarios.mod_almacen_hint, icon: Warehouse },
  almacen_compras: { label: strings.usuarios.mod_almacen_compras, hint: strings.usuarios.mod_almacen_compras_hint, icon: ShoppingCart },
  almacen_costos: { label: strings.usuarios.mod_almacen_costos, hint: strings.usuarios.mod_almacen_costos_hint, icon: BadgeDollarSign },
  almacen_ajustes: { label: strings.usuarios.mod_almacen_ajustes, hint: strings.usuarios.mod_almacen_ajustes_hint, icon: ICON.adjust },
  almacen_herramientas: { label: strings.usuarios.mod_almacen_herramientas, hint: strings.usuarios.mod_almacen_herramientas_hint, icon: Wrench },
  directorio: { label: strings.usuarios.mod_directorio, hint: strings.usuarios.mod_directorio_hint, icon: BookUser },
  inspecciones: { label: strings.usuarios.mod_inspecciones, hint: strings.usuarios.mod_inspecciones_hint, icon: ClipboardCheck },
  diseno: { label: strings.usuarios.mod_diseno, hint: strings.usuarios.mod_diseno_hint, icon: ICON.designer },
  taller: { label: strings.usuarios.mod_taller, hint: strings.usuarios.mod_taller_hint, icon: ICON.taller },
  accesos: { label: strings.usuarios.mod_accesos, hint: strings.usuarios.mod_accesos_hint, icon: Zap },
  form_autorizaciones: { label: strings.usuarios.mod_form_autorizaciones, hint: strings.usuarios.mod_form_autorizaciones_hint, icon: FileCheck },
  form_registro: { label: strings.usuarios.mod_form_registro, hint: strings.usuarios.mod_form_registro_hint, icon: UserPlus },
};
