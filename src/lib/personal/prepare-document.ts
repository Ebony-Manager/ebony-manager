"use client";

/**
 * Prepara un archivo de documento para subir: las fotos se achican a
 * 2000 px y pasan a JPEG (legibles, pero sin los varios MB del celular); un
 * PDF va tal cual. Solo en el navegador (usa canvas).
 */
const MAX_SIDE = 2000;

export async function prepareDocument(file: File): Promise<{ blob: Blob; contentType: string; ext: "jpg" | "pdf" }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return { blob: file, contentType: "application/pdf", ext: "pdf" };
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.88)
  );
  return { blob, contentType: "image/jpeg", ext: "jpg" };
}
