import { describe, expect, it } from "vitest";

import { normalizePunch, parsePunchDate, parsePunchTime, punchKey } from "./jotform-punch";
import { answersFromRawRequest } from "@/lib/personal/jotform-intake";

describe("parsePunchTime", () => {
  it("lee los formatos de JotForm", () => {
    expect(parsePunchTime({ hourSelect: "08", minuteSelect: "29" })).toBe(8 * 60 + 29);
    expect(parsePunchTime({ timeInput: "17:08", hourSelect: "17", minuteSelect: "08" })).toBe(17 * 60 + 8);
    expect(parsePunchTime({ hourSelect: "5", minuteSelect: "08", ampm: "PM" })).toBe(17 * 60 + 8);
    expect(parsePunchTime({ hourSelect: "12", minuteSelect: "10", ampm: "AM" })).toBe(10);
    expect(parsePunchTime("08 29")).toBe(8 * 60 + 29);
    expect(parsePunchTime("5:08 pm")).toBe(17 * 60 + 8);
    expect(parsePunchTime("")).toBeNull();
    expect(parsePunchTime("25:00")).toBeNull();
  });
});

describe("parsePunchDate", () => {
  it("lee los formatos de JotForm", () => {
    expect(parsePunchDate({ month: "10", day: "21", year: "2026" })).toBe("2026-10-21");
    expect(parsePunchDate("10 21 2026 2026-10-21 00:00:00")).toBe("2026-10-21");
    expect(parsePunchDate("10/21/2026")).toBe("2026-10-21");
    expect(parsePunchDate("2026-10-21")).toBe("2026-10-21");
    expect(parsePunchDate("")).toBeNull();
  });
});

describe("normalizePunch", () => {
  it("una respuesta del webhook (rawRequest) → la marcación", () => {
    const answers = answersFromRawRequest({
      q3_fecha: { month: "10", day: "21", year: "2026" },
      q4_id: "Eds02",
      q5_entradaO: "ENTRADA",
      q6_foto: "data:image/png;base64,AAAA",
      q7_hora: { hourSelect: "08", minuteSelect: "29" },
      q8_detectedLocation: "https://maps.google.com/maps?z=14&q=8.99480,-79.52300",
      q9_tempNombre: "Douglas  Serna",
      slug: "submit/230425597385868",
    });
    expect(normalizePunch(answers)).toEqual({
      name: "Douglas Serna",
      code: "Eds02",
      date: "2026-10-21",
      minutes: 8 * 60 + 29,
      kind: "in",
      source: "jotform",
      location: "https://maps.google.com/maps?z=14&q=8.99480,-79.52300",
    });
  });
  it("sin nombre usa el código; sin fecha u hora (el TEST) no hay marcación", () => {
    const p = normalizePunch({ fecha: "10/20/2026", typeA: "EJH17", entradaO: "SALIDA", hora: "17 08", tempNombre: "undefined" });
    expect(p).toMatchObject({ name: "EJH17", code: "EJH17", kind: "out", minutes: 17 * 60 + 8 });
    expect(normalizePunch({ fecha: "", hora: "", tempNombre: "", id: "" })).toBeNull();
  });
});

describe("punchKey", () => {
  it("la misma ponchada por webhook y por export da la misma clave", () => {
    const a = punchKey({ source: "jotform", name: "Douglas Serna", code: "Eds02", date: "2026-10-21", minutes: 509 });
    const b = punchKey({ source: "jotform", name: "douglas serna", code: "EDS02", date: "2026-10-21", minutes: 509 });
    expect(a).toBe(b);
    expect(punchKey({ source: "reloj", name: "José  Salcedo", date: "2026-10-21", minutes: 450 })).toBe("reloj|jose salcedo|2026-10-21|450");
  });
});
