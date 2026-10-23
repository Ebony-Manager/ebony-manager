/** Una persona del personal tal como la ve "Documentos del personal":
 *  solo datos de identificación y contacto — nada de dinero ni banco. */
export interface DirectoryPerson {
  kind: "employee" | "contractor";
  id: string;
  name: string;
  /** Taller / Administrativo (empleado) o Ebanista / Pintor (contratista). */
  group: string;
  /** Puesto del empleado; null en contratistas. */
  position: string | null;
  active: boolean;
  startDate: string | null;
  /** Orden en su lista (el color del avatar de un empleado sale de acá). */
  sortOrder: number;
  idDocument: string | null;
  idDocumentType: "cedula" | "pasaporte" | null;
  /** URL firmada (1 h) de la foto o PDF del documento. */
  documentUrl: string | null;
  documentIsPdf: boolean;
  nationality: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  photoUrl: string | null;
}
