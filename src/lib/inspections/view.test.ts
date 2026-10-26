import { describe, expect, it } from "vitest";

import type { Inspection, InspectionItem } from "@/types/inspections";
import { allItems, areaSuggestions, countItems, inspectionPhotoPath, visitsToShow } from "./view";

const item = (id: string, area: string | null, status: InspectionItem["status"], createdAt = "2026-10-01T10:00:00Z"): InspectionItem => ({
  id,
  inspectionId: "",
  area,
  comment: id,
  status,
  resolvedAt: null,
  resolvedByName: null,
  createdAt,
  photos: [],
});

const visits: Inspection[] = [
  {
    id: "v2",
    projectId: "p",
    visitedOn: "2026-10-20",
    notes: null,
    createdByName: null,
    createdAt: "",
    items: [item("b", "Cocina", "pendiente"), item("c", null, "pendiente"), item("d", "Baño", "resuelto")],
  },
  {
    id: "v1",
    projectId: "p",
    visitedOn: "2026-10-10",
    notes: null,
    createdByName: null,
    createdAt: "",
    items: [item("a", "cocina", "pendiente"), item("e", "Sala", "resuelto")],
  },
];

describe("inspecciones", () => {
  it("por visita: solo pendientes quita lo resuelto y las visitas sin nada pendiente", () => {
    const shown = visitsToShow(visits, true);
    expect(shown.map((v) => v.items.map((i) => i.id))).toEqual([["b", "c"], ["a"]]);
    expect(visitsToShow([{ ...visits[1], items: [item("e", "Sala", "resuelto")] }], true)).toEqual([]);
    expect(visitsToShow(visits, false)).toHaveLength(2);
  });

  it("todo junto: por área (sin área al final), y dentro del área del más viejo al más nuevo", () => {
    expect(allItems(visits, false).map((i) => i.id)).toEqual(["d", "a", "b", "e", "c"]);
    expect(allItems(visits, true).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(allItems(visits, true)[0].visitedOn).toBe("2026-10-10");
  });

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
