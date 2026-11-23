import { cleanUnit } from "@/lib/ventas/opportunities";

/**
 * La dirección de una obra en una línea: «Barrio · Edificio 19C» (con lo que haya; "" si no hay nada).
 * Igual que `private.project_address` en la base.
 */
export function projectAddress(p: { location?: string | null; building?: string | null; unit?: string | null }): string {
  const place = [p.building?.trim(), cleanUnit(p.unit)].filter(Boolean).join(" ");
  return [p.location?.trim(), place].filter(Boolean).join(" · ");
}
