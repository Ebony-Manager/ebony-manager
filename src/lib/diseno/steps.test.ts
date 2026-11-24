import { describe, expect, it } from "vitest";
import { hasStepFile, stepFiles } from "./steps";

const f = (kind: "medidas" | "presentacion" | "aprobada" | "foto", round: number) => ({ kind, round });

describe("documentos de cada paso", () => {
  it("la hoja de medidas habilita «Medido»", () => {
    expect(hasStepFile({ round: 0, files: [] }, "medido")).toBe(false);
    expect(hasStepFile({ round: 0, files: [f("medidas", 0)] }, "medido")).toBe(true);
  });
  it("«Cliente aprobó» pide la presentación aprobada (una presentación enviada no cuenta)", () => {
    expect(hasStepFile({ round: 0, files: [f("presentacion", 1)] }, "aprobado")).toBe(false);
    expect(stepFiles({ round: 0, files: [f("aprobada", 0), f("medidas", 0)] }, "aprobado")).toEqual([f("aprobada", 0)]);
  });
});

import { fileAction } from "./steps";

describe("qué se puede hacer con un archivo", () => {
  it("la hoja de medidas se quita en Por medir y después solo se cambia", () => {
    expect(fileAction({ stage: "por_medir" }, { kind: "medidas" }, null)).toBe("quitar");
    expect(fileAction({ stage: "en_diseno" }, { kind: "medidas" }, null)).toBe("cambiar");
  });
  it("la aprobada se cambia una vez aprobado; en una orden en revisión todo queda fijo", () => {
    expect(fileAction({ stage: "en_diseno" }, { kind: "aprobada" }, null)).toBe("quitar");
    expect(fileAction({ stage: "aprobado" }, { kind: "aprobada" }, "borrador")).toBe("cambiar");
    expect(fileAction({ stage: "aprobado" }, { kind: "medidas" }, "en_revision")).toBe("fijo");
  });
});
