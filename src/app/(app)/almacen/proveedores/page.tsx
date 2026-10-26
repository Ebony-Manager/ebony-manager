import { redirect } from "next/navigation";

// Los proveedores pasaron al Directorio (sección propia, no solo del Almacén).
export default function ProveedoresPage() {
  redirect("/directorio");
}
