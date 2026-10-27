import { describe, expect, it } from "vitest";

import { RAIL_ITEMS, SETTINGS_PANEL, orderNavigation, ALMACEN_PANEL, PERSONAL_PANEL, canSeeNavItem, panelHome, type NavPanel } from "./nav-items";
import { visibleQuickLinks } from "./quick-links";

const visible = (panel: NavPanel, modules: string[]) => ({ ...panel, items: panel.items.filter((i) => canSeeNavItem(i, { role: "vendedor", modules })) });
const hrefs = (panel: NavPanel, modules: string[]) => visible(panel, modules).items.map((i) => i.href);

describe("menú por permisos", () => {
  it("Almacén: sin Compras abre Nueva salida; con Compras, Inventario", () => {
    const angelys = ["almacen", "directorio"];
    expect(panelHome(visible(ALMACEN_PANEL, angelys), { role: "vendedor", modules: angelys })?.href).toBe("/almacen/salidas");
    const karina = ["almacen", "almacen_compras"];
    expect(panelHome(visible(ALMACEN_PANEL, karina), { role: "vendedor", modules: karina })?.href).toBe("/almacen");
  });

  it("Personal: con Asistencia sin Planilla ve «Asistencia» primero y nunca «Pagos»", () => {
    const nabil = ["proyectos", "documentos", "asistencia", "almacen", "directorio"];
    expect(hrefs(PERSONAL_PANEL, nabil)).toEqual(["/personal/asistencia", "/personal/staff"]);
    expect(panelHome(visible(PERSONAL_PANEL, nabil), { role: "vendedor", modules: nabil })?.href).toBe("/personal/asistencia");
  });

  it("Personal: con Planilla sigue igual (Resumen, Personal, Pagos)", () => {
    expect(hrefs(PERSONAL_PANEL, ["documentos", "planilla", "asistencia"])).toEqual(["/personal", "/personal/staff", "/personal/pagos"]);
  });
});

describe("accesos rápidos", () => {
  it("son a elección: el admin no los tiene si no se los marcan", () => {
    expect(visibleQuickLinks({ role: "admin", modules: [] })).toEqual([]);
    expect(visibleQuickLinks({ role: "admin", modules: ["accesos", "form_registro"] }).map((l) => l.key)).toEqual(["registro"]);
    expect(visibleQuickLinks({ role: "vendedor", modules: ["accesos", "form_autorizaciones"] }).map((l) => l.key)).toEqual(["auth-pintura", "auth-embalaje"]);
  });
});

describe("prioridad de navegación", () => {
  const admin = { role: "admin" as const, modules: [] };
  const destinations = (subject: typeof admin | { role: "vendedor"; modules: string[] }) => [
    ...RAIL_ITEMS.filter((item) => canSeeNavItem(item, subject)).map((item) => ({ key: item.href })),
    ...[ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL].filter((panel) => panel.items.some((item) => canSeeNavItem(item, subject))).map((panel) => ({ key: panel.key })),
  ];
  it("admin móvil: Dashboard, Almacén, Proyectos y Personal; herramientas en Más", () => {
    expect(orderNavigation(destinations(admin), "mobile", admin).slice(0, 4).map((e) => e.key)).toEqual(["/dashboard", "almacen", "/proyectos", "personal"]);
  });
  it("admin web: Dashboard, Proyectos, Personal y Almacén", () => {
    expect(orderNavigation(destinations(admin), "desktop", admin).map((e) => e.key)).toEqual(["/dashboard", "/proyectos", "personal", "almacen", "/inspecciones", "/cotizacion", "/directorio", "settings"]);
  });
  it("solo inspecciones: mantiene su herramienta accesible y no inventa permisos", () => {
    const subject = { role: "vendedor" as const, modules: ["inspecciones"] };
    expect(orderNavigation(destinations(subject), "mobile", subject).map((e) => e.key)).toEqual(["/dashboard", "/inspecciones", "almacen"]);
  });
  it("almacén sin Personal: llena los espacios con módulos permitidos", () => {
    const subject = { role: "vendedor" as const, modules: ["almacen", "cotizacion"] };
    expect(orderNavigation(destinations(subject), "mobile", subject).slice(0, 4).map((e) => e.key)).toEqual(["/dashboard", "almacen", "/cotizacion", "/directorio"]);
  });
});
