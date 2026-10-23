import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { DirectoryPerson } from "@/types/staff-directory";
import { signedPhotoUrls } from "./photos";

type Row = Database["public"]["Functions"]["staff_people"]["Returns"][number];

/**
 * El personal sin dinero: empleados y contratistas con sus datos de
 * identificación y contacto, por `staff_people()` — una función de la base
 * que devuelve solo columnas seguras (sin sueldos ni cuentas), así que sirve
 * para el permiso "Personal" (`documentos`), que no abre las tablas. Con
 * Planilla vienen los empleados y con Contratistas los contratistas, como
 * siempre. Fotos y documentos van con URL firmada de 1 h.
 */
export async function getStaffDirectory(): Promise<DirectoryPerson[]> {
  const rows = await fetchRows();
  return (await toPeople(rows)).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

/** Una persona (para su ficha sin dinero); null si no existe o no se puede ver. */
export async function getStaffPerson(kind: DirectoryPerson["kind"], id: string): Promise<DirectoryPerson | null> {
  const row = (await fetchRows()).find((r) => r.kind === kind && r.id === id);
  if (!row) return null;
  const [person] = await toPeople([row]);
  return person;
}

async function fetchRows(): Promise<Row[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_people");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function toPeople(rows: Row[]): Promise<DirectoryPerson[]> {
  const supabase = await createClient();
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

  return rows.map((r): DirectoryPerson => {
    const kind = r.kind === "contractor" ? "contractor" : "employee";
    return {
      kind,
      id: r.id,
      name: r.name,
      group: r.group_key,
      position: r.position,
      active: r.active,
      startDate: r.start_date,
      sortOrder: r.sort_order,
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
  });
}
