import { describe, expect, it } from "vitest";

import { answersFromApi, answersFromRawRequest } from "./jotform-intake";
import { answersFromWorkflowParams, normalizeMoneyRequest, parseMoneyCents, parseRequestType } from "./jotform-money";

// Respuesta real (anonimizada) del formulario "Solicitud Dinero", formato de la API.
const API = {
  "3": { name: "nombre", answer: { first: "NABIL MASSIEL", last: "SORIANO MANCILLA" } },
  "7": { name: "correoElectronico", answer: "Nabil@Example.com" },
  "14": { name: "monto", answer: "450.00" },
  "15": { name: "tipoDe", answer: "Prestamo" },
  "19": { name: "montoA", answer: "540" },
  "1": { name: "heading" },
};

describe("normalizeMoneyRequest", () => {
  it("lee nombre, correo, tipo y montos en centavos", () => {
    expect(normalizeMoneyRequest(answersFromApi(API))).toEqual({
      firstName: "Nabil Massiel",
      lastName: "Soriano Mancilla",
      email: "nabil@example.com",
      type: "prestamo",
      amountCents: 45000,
      deductCents: 54000,
    });
  });

  it("igual desde el rawRequest del webhook", () => {
    const raw = { q3_nombre: API["3"].answer, q7_correoElectronico: API["7"].answer, q14_monto: "450.00", q15_tipoDe: "Prestamo", q19_montoA: "540" };
    expect(normalizeMoneyRequest(answersFromRawRequest(raw))).toEqual(normalizeMoneyRequest(answersFromApi(API)));
  });

  it("sin monto a descontar: préstamo +20%, adelanto igual", () => {
    expect(normalizeMoneyRequest({ tipoDe: "Préstamo", monto: "300" }).deductCents).toBe(36000);
    expect(normalizeMoneyRequest({ tipoDe: "Adelanto", monto: "75.5" }).deductCents).toBe(7550);
  });
});

describe("piezas", () => {
  it("montos", () => {
    expect(parseMoneyCents("$1,200.50")).toBe(120050);
    expect(parseMoneyCents(214.23)).toBe(21423);
    expect(parseMoneyCents("abc")).toBeNull();
  });
  it("tipo", () => {
    expect(parseRequestType("Préstamo")).toBe("prestamo");
    expect(parseRequestType("Adelanto")).toBe("adelanto");
    expect(parseRequestType("Otro")).toBeNull();
  });
});

describe("answersFromWorkflowParams", () => {
  it("parámetros sueltos del webhook del workflow → mismos datos", () => {
    const answers = answersFromWorkflowParams({ nombre: "NABIL MASSIEL", apellido: "SORIANO MANCILLA", correo: "Nabil@Example.com", tipo: "Prestamo", monto: "450.00", montoDescontar: "540" });
    expect(answers && normalizeMoneyRequest(answers)).toEqual(normalizeMoneyRequest(answersFromApi(API)));
  });
  it("solo el nombre completo: se parte en nombre y apellido", () => {
    const answers = answersFromWorkflowParams({ nombre: "Nolberto  Figueredo Guateque", correo: "", monto: "100", tipo: "Adelanto" });
    expect(answers && normalizeMoneyRequest(answers)).toMatchObject({ firstName: "Nolberto", lastName: "Figueredo Guateque" });
  });
  it("el nombre completo como objeto JSON también sirve", () => {
    const answers = answersFromWorkflowParams({ nombre: '{"first":"Ana","last":"Pérez"}', monto: "50", tipo: "Adelanto" });
    expect(answers && normalizeMoneyRequest(answers)).toMatchObject({ firstName: "Ana", lastName: "Pérez", amountCents: 5000, type: "adelanto" });
  });
  it("sin datos → null", () => {
    expect(answersFromWorkflowParams({ formID: "1" })).toBeNull();
  });
});
