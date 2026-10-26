import { redirect } from "next/navigation";

// Ajustes ya no es una sección: se hacen desde Inventario y se ven en Movimientos.
export default function AjustesPage() {
  redirect("/almacen/movimientos?tipo=ajuste");
}
