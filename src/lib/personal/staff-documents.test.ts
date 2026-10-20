import { describe, expect, it } from "vitest";

import { documentExt, documentPath, groupImportFiles, isPdfPath } from "./staff-documents";
import { matchPersonByName } from "./jotform-intake";

describe("groupImportFiles", () => {
  it("una subcarpeta por persona: la foto más grande, no la firma ni el PDF", () => {
    const groups = groupImportFiles([
      { path: "Vigente/Javier Alonzo dominguez/Javier-Alonzo-dominguez-_06-05-1999.pdf", size: 133_000 },
      { path: "Vigente/Javier Alonzo dominguez/17914667178311398253810457828322.jpg", size: 3_465_000 },
      { path: "Vigente/Javier Alonzo dominguez/6672770497617169604_signature_22.png", size: 9_000_000 },
      { path: "Vigente/José  Padilla/registro.pdf", size: 120_000 },
      { path: "Vigente/José  Padilla/.DS_Store", size: 10 },
    ]);
    expect(groups.map((g) => [g.name, g.file?.path])).toEqual([
      ["Javier Alonzo dominguez", "Vigente/Javier Alonzo dominguez/17914667178311398253810457828322.jpg"],
      ["José Padilla", "Vigente/José  Padilla/registro.pdf"],
    ]);
  });

  it("archivos sueltos: la persona es el nombre del archivo", () => {
    expect(groupImportFiles([{ path: "Jose Salcedo.jpeg", size: 1 }])).toEqual([
      { name: "Jose Salcedo", file: { path: "Jose Salcedo.jpeg", size: 1 } },
    ]);
  });
});

describe("matchPersonByName", () => {
  const people = [
    { id: "1", name: "Jeremy Hernandez" },
    { id: "2", name: "Jose Padilla" },
    { id: "3", name: "Jesus Herrera" },
    { id: "4", name: "Jesus Vargas" },
    { id: "5", name: "Javier Alonzo Dominguez" },
  ];
  it("igual sin acentos ni espacios de más, o primer nombre + un apellido", () => {
    expect(matchPersonByName("José  Padilla", people)?.id).toBe("2");
    expect(matchPersonByName("Jeremy liam Hernández Quiróz", people)?.id).toBe("1");
    expect(matchPersonByName("Javier Alonzo dominguez", people)?.id).toBe("5");
  });
  it("sin apellido en común o ambiguo → null", () => {
    expect(matchPersonByName("Jesus Carballo", people)).toBeNull();
    expect(matchPersonByName("Ana", people)).toBeNull();
  });
});

describe("rutas", () => {
  it("documentPath / documentExt / isPdfPath", () => {
    expect(documentPath("employee", "e1", "jpg", 5)).toBe("employees/e1/5.jpg");
    expect(documentPath("contractor", "c1", "pdf", 5)).toBe("contractors/c1/5.pdf");
    expect(documentExt("image/jpeg; charset=binary")).toBe("jpg");
    expect(documentExt("text/html")).toBeNull();
    expect(isPdfPath("employees/e1/5.pdf")).toBe(true);
  });
});
