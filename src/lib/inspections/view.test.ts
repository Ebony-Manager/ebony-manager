import { describe, expect, it } from "vitest";

import type { Inspection, InspectionItem } from "@/types/inspections";
import { DEFAULT_FILTERS, areaSuggestions, countItems, groupItems, hasExtraFilters, inspectionPhotoPath, matchesFilters, type ItemFilters } from "./view";

const item = (id: string, area: string | null, status: InspectionItem["status"], extra: Partial<InspectionItem> = {}): InspectionItem => ({
  id,
  inspectionId: "",
  area,
  comment: id,
  kind: null,
  painterId: null,
  painterName: null,
  responsible: "ebony",
  thirdParty: null,
  status,
  resolvedAt: null,
  resolvedByName: null,
  createdAt: "2026-10-01T10:00:00Z",
  photos: [],
  ...extra,
});

const visits: Inspection[] = [
  {
    id: "v2",
    projectId: "p",
    visitedOn: "2026-10-20",
    notes: null,
    createdByName: null,
    createdAt: "",
    items: [
      item("b", "Cocina", "pendiente", { kind: "pintura", painterId: "p1" }),
      item("c", null, "pendiente", { kind: "carpinteria", responsible: "tercero", thirdParty: "plomero" }),
      item("d", "Baño", "resuelto", { kind: "pintura", painterId: "p2" }),
    ],
  },
  {
    id: "v1",
    projectId: "p",
    visitedOn: "2026-10-10",
    notes: null,
    createdByName: null,
    createdAt: "",
    items: [item("a", "cocina", "pendiente"), item("e", "Sala", "resuelto", { kind: "otro" })],
  },
  { id: "v0", projectId: "p", visitedOn: "2026-10-26", notes: null, createdByName: null, createdAt: "", items: [] },
];

const all: ItemFilters = { ...DEFAULT_FILTERS, onlyPending: false };
const ids = (g: { items: { id: string }[] }[]) => g.map((x) => x.items.map((i) => i.id));

describe("inspecciones: filtros", () => {
  it("pendientes, tipo, sin clasificar, pintor y responsable", () => {
    const by = (f: Partial<ItemFilters>) => visits.flatMap((v) => v.items).filter((i) => matchesFilters(i, { ...all, ...f })).map((i) => i.id);
    expect(by({ onlyPending: true })).toEqual(["b", "c", "a"]);
    expect(by({ kind: "pintura" })).toEqual(["b", "d"]);
    expect(by({ kind: "sin" })).toEqual(["a"]);
    expect(by({ painterId: "p1" })).toEqual(["b"]);
    expect(by({ responsible: "tercero" })).toEqual(["c"]);
    expect(hasExtraFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasExtraFilters({ ...DEFAULT_FILTERS, kind: "otro" })).toBe(true);
  });
});

describe("inspecciones: agrupar", () => {
  it("por visita: la visita vacía se ve; la que no tiene nada que pase el filtro, no", () => {
    expect(groupItems(visits, DEFAULT_FILTERS, "visita").map((g) => g.key)).toEqual(["v2", "v1", "v0"]);
    expect(groupItems(visits, { ...all, kind: "otro" }, "visita").map((g) => g.key)).toEqual(["v1", "v0"]);
  });

  it("por área: sin importar mayúsculas, alfabético, sin área al final y del más viejo al más nuevo", () => {
    const g = groupItems(visits, all, "area");
    expect(g.map((x) => x.title)).toEqual(["Baño", "Cocina", "Sala", null]);
    expect(ids(g)).toEqual([["d"], ["a", "b"], ["e"], ["c"]]);
  });

  it("todo junto: un solo grupo por área y fecha", () => {
    expect(ids(groupItems(visits, all, "junto"))).toEqual([["d", "a", "b", "e", "c"]]);
    expect(groupItems(visits, { ...all, kind: "sin", responsible: "tercero" }, "junto")).toEqual([]);
  });
});

describe("inspecciones: otros", () => {
  it("cuenta pendientes y resueltos", () => {
    expect(countItems(visits)).toEqual({ pending: 3, resolved: 2 });
  });

  it("sugiere primero las áreas usadas, sin repetir mayúsculas", () => {
    const s = areaSuggestions(visits);
    expect(s.slice(0, 3)).toEqual(["Cocina", "Baño", "Sala"]);
    expect(s.filter((a) => a.toLowerCase() === "cocina")).toHaveLength(1);
  });

  it("guarda las fotos en la carpeta de la visita", () => {
    expect(inspectionPhotoPath("v1", "x")).toBe("v1/x.jpg");
  });
});
