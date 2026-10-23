import { describe, expect, it } from "vitest";

import { documentExt, documentPath, isPdfPath } from "./staff-documents";

describe("rutas", () => {
  it("documentPath / documentExt / isPdfPath", () => {
    expect(documentPath("employee", "e1", "jpg", 5)).toBe("employees/e1/5.jpg");
    expect(documentPath("contractor", "c1", "pdf", 5)).toBe("contractors/c1/5.pdf");
    expect(documentExt("image/jpeg; charset=binary")).toBe("jpg");
    expect(documentExt("text/html")).toBeNull();
    expect(isPdfPath("employees/e1/5.pdf")).toBe(true);
  });
});
