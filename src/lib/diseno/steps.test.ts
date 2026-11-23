import { describe, expect, it } from "vitest";
import { fileRound, hasStepFile, stepFiles } from "./steps";

const f = (kind: "medidas" | "presentacion" | "aprobada" | "foto", round: number) => ({ kind, round });

describe("documentos de cada paso", () => {
  it("la hoja de medidas habilita «Medido»", () => {
    expect(hasStepFile({ round: 0, files: [] }, "medido")).toBe(false);
    expect(hasStepFile({ round: 0, files: [f("medidas", 0)] }, "medido")).toBe(true);
  });
  it("«Enviar» pide la presentación de la ronda nueva (no la de una ronda anterior)", () => {
    expect(fileRound({ round: 1 }, "presentacion")).toBe(2);
    expect(hasStepFile({ round: 1, files: [f("presentacion", 1)] }, "enviar")).toBe(false);
    expect(hasStepFile({ round: 1, files: [f("presentacion", 1), f("presentacion", 2)] }, "enviar")).toBe(true);
  });
  it("«Cliente aprobó» pide la aprobada de la ronda que está con el cliente", () => {
    expect(hasStepFile({ round: 2, files: [f("aprobada", 1)] }, "aprobado")).toBe(false);
    expect(stepFiles({ round: 2, files: [f("aprobada", 2), f("medidas", 0)] }, "aprobado")).toEqual([f("aprobada", 2)]);
  });
});
