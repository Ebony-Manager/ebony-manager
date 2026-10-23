import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DirectoryPerson } from "@/types/staff-directory";
import { signedPhotoUrls } from "./photos";

/**
 * "Documentos del personal": empleados y contratistas con sus datos de
 * identificación y contacto, por `staff_directory()` — una función de la
 * base que devuelve solo columnas seguras (sin sueldos ni cuentas), así que
 * sirve para el permiso `documentos`, que no abre las tablas. Con Planilla
 * vienen los empleados y con Contratistas los contratistas, como siempre.
 * Fotos y documentos van con URL firmada de 1 h.
 */
export async function getStaffDirectory(): Promise<DirectoryPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_directory");
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const docPaths = rows.map((r) => r.id_document_path).filter((p): p is string => !!p);
  const docUrls = new Map<string, string>();
  if (docPaths.length > 0) {
    const { data: signed } = await supabase.storage.from("staff-documents").createSignedUrls(docPaths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) docUrls.set(s.path, s.signedUrl);
  }
  const people = (kind: string) =>
    rows.filter((r) => r.kind === kind).map((r) => ({ id: r.id, photoPath: r.photo_path }));
  const [employeePhotos, contractorPhotos] = await Promise.all([
    signedPhotoUrls("employee-photos", people("employee")),
    signedPhotoUrls("contractor-photos", people("contractor")),
  ]);

  return rows
    .map((r): DirectoryPerson => {
      const kind = r.kind === "contractor" ? "contractor" : "employee";
      return {
        kind,
        id: r.id,
        name: r.name,
        group: r.group_key,
        position: r.position,
        active: r.active,
        idDocument: r.id_document,
        idDocumentType: r.id_document_type === "cedula" || r.id_document_type === "pasaporte" ? r.id_document_type : null,
        documentUrl: r.id_document_path ? (docUrls.get(r.id_document_path) ?? null) : null,
        documentIsPdf: /\.pdf$/i.test(r.id_document_path ?? ""),
        nationality: r.nationality,
        birthDate: r.birth_date,
        phone: r.phone,
        email: r.email,
        address: r.address,
        emergencyContactName: r.emergency_contact_name,
        emergencyContactPhone: r.emergency_contact_phone,
        photoUrl: (kind === "employee" ? employeePhotos : contractorPhotos)[r.id] ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}
