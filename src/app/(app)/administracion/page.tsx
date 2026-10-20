import { redirect } from "next/navigation";

// "Administración" pasó a llamarse "Personal" (/personal): esta dirección
// vieja queda solo para que no se rompan enlaces guardados.
export default function AdministracionRedirect() {
  redirect("/personal");
}
