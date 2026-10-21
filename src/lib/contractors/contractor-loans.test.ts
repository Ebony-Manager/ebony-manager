import { describe, expect, it } from "vitest";

import { installmentDate, isScheduled, todayInPanama } from "./contractor-loans";

describe("installmentDate", () => {
  it("cae al inicio de la quincena", () => {
    expect(installmentDate({ year: 2026, month: 11, half: 1 }, "2026-10-21")).toBe("2026-11-01");
    expect(installmentDate({ year: 2026, month: 11, half: 2 }, "2026-10-21")).toBe("2026-11-16");
  });

  it("nunca antes de la solicitud", () => {
    expect(installmentDate({ year: 2026, month: 10, half: 2 }, "2026-10-21")).toBe("2026-10-21");
  });
});

describe("isScheduled", () => {
  it("solo una cuota con fecha futura está programada", () => {
    expect(isScheduled({ loanId: "l1", entryDate: "2026-11-01" }, "2026-10-21")).toBe(true);
    expect(isScheduled({ loanId: "l1", entryDate: "2026-10-21" }, "2026-10-21")).toBe(false);
    expect(isScheduled({ loanId: null, entryDate: "2026-12-03" }, "2026-10-21")).toBe(false);
  });
});

describe("todayInPanama", () => {
  it("usa la hora de Panamá (UTC−5)", () => {
    expect(todayInPanama(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-21");
    expect(todayInPanama(new Date("2026-10-22T06:00:00Z"))).toBe("2026-10-22");
  });
});
