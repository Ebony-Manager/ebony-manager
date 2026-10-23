import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { buildDocumentsPdf } from "@/lib/personal/documents-pdf";

// PNG de 1×1 (transparente).
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function pdfDataUrl(pages: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return `data:application/pdf;base64,${Buffer.from(await doc.save()).toString("base64")}`;
}

describe("buildDocumentsPdf", () => {
  it("pone dos fotos por hoja y agrega los PDF completos en hoja aparte", async () => {
    const pdf = await pdfDataUrl(2);
    const bytes = await buildDocumentsPdf([
      { name: "José Núñez", label: "Cédula 8-123-456", url: PNG, isPdf: false },
      { name: "Ana", label: "Pasaporte X1", url: PNG, isPdf: false },
      { name: "Luis", label: "", url: PNG, isPdf: false },
      { name: "Con PDF", label: "Cédula 1", url: pdf, isPdf: true },
      { name: "Otra", label: "Cédula 2", url: PNG, isPdf: false },
    ]);
    const out = await PDFDocument.load(bytes);
    // 2 fotos + 1 foto + 2 páginas del PDF + 1 foto = 5 hojas.
    expect(out.getPageCount()).toBe(5);
  });
});
