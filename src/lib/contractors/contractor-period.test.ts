import { describe, expect, it } from "vitest";

import {
  calendarWindow,
  isCalendarView,
  shiftAnchor,
  windowLabel,
} from "@/lib/contractors/contractor-period";

describe("isCalendarView", () => {
  it("solo mes/trimestre/semestre/año necesitan ancla + navegación", () => {
    expect(isCalendarView("month")).toBe(true);
    expect(isCalendarView("quarter")).toBe(true);
    expect(isCalendarView("semester")).toBe(true);
    expect(isCalendarView("year")).toBe(true);
    expect(isCalendarView("last15")).toBe(false);
    expect(isCalendarView("all")).toBe(false);
  });
});

describe("calendarWindow", () => {
  it("mes: del día 1 al último día del mismo mes", () => {
    expect(calendarWindow("month", 2026, 2)).toEqual({
      startISO: "2026-02-01",
      endISO: "2026-02-28",
    });
    // año bisiesto
    expect(calendarWindow("month", 2028, 2).endISO).toBe("2028-02-29");
  });

  it("trimestre: la ventana de 3 meses que contiene el mes ancla", () => {
    expect(calendarWindow("quarter", 2026, 8)).toEqual({
      startISO: "2026-07-01",
      endISO: "2026-09-30",
    });
    expect(calendarWindow("quarter", 2026, 1).startISO).toBe("2026-01-01");
    expect(calendarWindow("quarter", 2026, 12).endISO).toBe("2026-12-31");
  });

  it("semestre: H1 enero-junio, H2 julio-diciembre", () => {
    expect(calendarWindow("semester", 2026, 3)).toEqual({
      startISO: "2026-01-01",
      endISO: "2026-06-30",
    });
    expect(calendarWindow("semester", 2026, 9)).toEqual({
      startISO: "2026-07-01",
      endISO: "2026-12-31",
    });
  });

  it("año: el año calendario completo", () => {
    expect(calendarWindow("year", 2026, 5)).toEqual({
      startISO: "2026-01-01",
      endISO: "2026-12-31",
    });
  });
});

describe("shiftAnchor", () => {
  it("mes: avanza y retrocede cruzando el año", () => {
    expect(shiftAnchor("month", 2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftAnchor("month", 2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("trimestre: salta 3 meses al inicio de la ventana", () => {
    expect(shiftAnchor("quarter", 2026, 8, 1)).toEqual({ year: 2026, month: 10 });
    expect(shiftAnchor("quarter", 2026, 2, -1)).toEqual({ year: 2025, month: 10 });
  });

  it("semestre: salta 6 meses", () => {
    expect(shiftAnchor("semester", 2026, 4, 1)).toEqual({ year: 2026, month: 7 });
    expect(shiftAnchor("semester", 2026, 9, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("año: salta 12 meses, siempre a enero", () => {
    expect(shiftAnchor("year", 2026, 5, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftAnchor("year", 2026, 5, -1)).toEqual({ year: 2025, month: 1 });
  });
});

describe("windowLabel", () => {
  it("mes: nombre del mes + año, bilingüe", () => {
    expect(windowLabel("es", "month", 2026, 9)).toBe("Septiembre 2026");
    expect(windowLabel("en", "month", 2026, 9)).toBe("September 2026");
  });

  it("trimestre / semestre: códigos T/S (ES) y Q/H (EN)", () => {
    expect(windowLabel("es", "quarter", 2026, 8)).toBe("T3 2026");
    expect(windowLabel("en", "quarter", 2026, 8)).toBe("Q3 2026");
    expect(windowLabel("es", "semester", 2026, 9)).toBe("S2 2026");
    expect(windowLabel("en", "semester", 2026, 3)).toBe("H1 2026");
  });

  it("año: solo el año", () => {
    expect(windowLabel("es", "year", 2026, 5)).toBe("2026");
  });
});
