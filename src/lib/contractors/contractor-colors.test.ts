import { describe, expect, it } from "vitest";

import { categoryDotStyle, categoryRowStyle } from "@/lib/contractors/contractor-colors";

describe("categoryRowStyle — paleta full vs sober", () => {
  it('"full": una categoría con color tiñe la fila (mezcla el token sobre --background)', () => {
    const bg = String(categoryRowStyle("material", false, "full").backgroundColor);
    expect(bg).toContain("--contractor-cat-material");
    expect(bg).toContain("var(--background)");
  });

  it('"sober": la fila queda neutra aunque la categoría tenga color', () => {
    const bg = String(categoryRowStyle("material", false, "sober").backgroundColor);
    expect(bg).not.toContain("--contractor-cat-");
    expect(bg).toBe("var(--background)");
  });

  it("categoría neutra: sin tinte en cualquier paleta", () => {
    expect(categoryRowStyle("ajuste", false, "full").backgroundColor).toBe("var(--background)");
    expect(categoryRowStyle("ajuste", false, "sober").backgroundColor).toBe("var(--background)");
  });

  it("el hover suma un realce en AMBAS paletas (mismo tratamiento)", () => {
    for (const palette of ["full", "sober"] as const) {
      const bg = String(categoryRowStyle("pago", true, palette).backgroundColor);
      expect(bg).toContain("var(--foreground) 6%");
    }
  });

  it('"full" es el valor por defecto del parámetro', () => {
    expect(categoryRowStyle("material", false)).toEqual(categoryRowStyle("material", false, "full"));
  });
});

describe("categoryDotStyle", () => {
  it("devuelve el color de la categoría, o null si es neutra", () => {
    expect(categoryDotStyle("pago")).toEqual({ backgroundColor: "var(--contractor-cat-pago)" });
    expect(categoryDotStyle("ajuste")).toBeNull();
  });
});
