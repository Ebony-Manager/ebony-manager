import { describe, expect, it } from "vitest";

import { achFileName, buildAchPayload, buildAddenda, sanitizeAchText, type AchEmployeeInput } from "./bank-export";

const base: AchEmployeeInput = {
  employeeId: "e1",
  name: "José Salcedo",
  idDocument: "8-123-4567",
  bankRoutingCode: "71",
  bankAccountNumber: "04-30 1234567",
  bankAccountType: "ahorro",
  paymentMethod: "transferencia",
  netCents: 56794,
};

describe("buildAchPayload", () => {
  it("arma la fila con el formato de la plantilla", () => {
    const p = buildAchPayload([base], "Pago de Planilla");
    expect(p.rows).toEqual([
      {
        id: "8-123-4567",
        name: "JOSE SALCEDO",
        route: "71",
        account: "04-301234567",
        accountType: "04",
        amount: 567.94,
        transType: "C",
        addenda: "REF*TXT**Pago de Planilla\\",
      },
    ]);
    expect(p.totalCents).toBe(56794);
  });

  it("solo transferencias con neto mayor a cero entran; el resto se reporta aparte", () => {
    const p = buildAchPayload(
      [base, { ...base, employeeId: "e2", paymentMethod: "efectivo" }, { ...base, employeeId: "e3", netCents: 0 }],
      "x"
    );
    expect(p.rows).toHaveLength(1);
    expect(p.skipped.map((s) => s.reason)).toEqual(["not_transfer", "zero"]);
  });

  it("un empleado al que le falta algún dato NO entra al archivo y se lista con sus faltantes", () => {
    const p = buildAchPayload(
      [{ ...base, idDocument: null, bankRoutingCode: " ", bankAccountNumber: "", bankAccountType: null }],
      "x"
    );
    expect(p.rows).toEqual([]);
    expect(p.incomplete[0].problems).toEqual(["no_id", "no_route", "no_account", "no_account_type"]);
    expect(p.totalCents).toBe(0);
  });

  it("corriente usa su propio código", () => {
    expect(buildAchPayload([{ ...base, bankAccountType: "corriente" }], "x").rows[0].accountType).toBe("03");
  });

  it("el total suma solo lo exportado, sin errores de decimales", () => {
    const p = buildAchPayload(
      [{ ...base, netCents: 10 }, { ...base, employeeId: "e2", netCents: 20 }],
      "x"
    );
    expect(p.rows.map((r) => r.amount)).toEqual([0.1, 0.2]);
    expect(p.totalCents).toBe(30);
  });
});

describe("textos", () => {
  it("sanitizeAchText: mayúsculas, sin acentos ni símbolos", () => {
    expect(sanitizeAchText("  María  Núñez, Jr. (Taller) ")).toBe("MARIA NUNEZ, JR. TALLER");
  });
  it("buildAddenda respeta REF*TXT**…\\ y limpia * y \\", () => {
    expect(buildAddenda("Pago 1Q Oct")).toBe("REF*TXT**Pago 1Q Oct\\");
    expect(buildAddenda("a*b\\c")).toBe("REF*TXT**a b c\\");
    expect(buildAddenda("")).toBe("REF*TXT**Pago de Planilla\\");
  });
  it("nombre de archivo como la plantilla", () => {
    expect(achFileName(new Date(2026, 8, 17))).toBe("ACH-FILE  _17-9-2026.xls");
  });
});
