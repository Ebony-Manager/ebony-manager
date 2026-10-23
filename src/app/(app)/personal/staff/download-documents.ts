import type { DirectoryPerson } from "@/types/staff-directory";
import { buildDocumentsPdf } from "@/lib/personal/documents-pdf";
import { todayInPanama } from "@/lib/contractors/contractor-loans";

/** "Cédula 8-123-456" / "Pasaporte X1" — lo que va debajo del nombre en el PDF. */
export function documentLabel(p: DirectoryPerson, cedula: string, pasaporte: string): string {
  if (!p.idDocument) return "";
  const type = p.idDocumentType === "pasaporte" ? pasaporte : p.idDocumentType === "cedula" ? cedula : "";
  return [type, p.idDocument].filter(Boolean).join(" ");
}

/**
 * Arma y descarga un solo PDF con los documentos de las personas elegidas.
 * Devuelve quiénes no tenían documento cargado (no van en el PDF).
 */
export async function downloadStaffDocuments(
  chosen: readonly DirectoryPerson[],
  opts: { fileName: string; cedula: string; pasaporte: string }
): Promise<{ included: number; missing: string[] }> {
  const withDoc = chosen.filter((p) => p.documentUrl);
  const missing = chosen.filter((p) => !p.documentUrl).map((p) => p.name);
  if (withDoc.length === 0) return { included: 0, missing };

  const bytes = await buildDocumentsPdf(
    withDoc.map((p) => ({
      name: p.name,
      label: documentLabel(p, opts.cedula, opts.pasaporte),
      url: p.documentUrl as string,
      isPdf: p.documentIsPdf,
    }))
  );
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.fileName} ${todayInPanama()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  return { included: withDoc.length, missing };
}
