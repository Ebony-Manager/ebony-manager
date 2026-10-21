import { redirect } from "next/navigation";

// Contratistas pasó a Personal → Pagos (Contratistas y Contratos) y su
// resumen al Resumen de Personal: esta dirección vieja queda solo para que
// no se rompan enlaces guardados.
export default function ContratistasRedirect() {
  redirect("/personal/pagos?tab=contratistas");
}
