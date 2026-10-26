import { describe, expect, it } from "vitest";

import { ALMACEN_PANEL, PERSONAL_PANEL, canSeeNavItem, panelHome, type NavPanel } from "./nav-items";
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
