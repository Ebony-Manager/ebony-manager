import { redirect } from "next/navigation";

// "Equipo" pasó a llamarse "Staff" (/personal/staff): esta dirección vieja
// queda solo para que no se rompan enlaces guardados.
export default function EquipoRedirect() {
  redirect("/personal/staff");
}
