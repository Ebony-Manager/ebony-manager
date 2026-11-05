// Fotos privadas con dirección fija: /api/foto/<bucket>/<ruta>. La dirección
// no cambia (a diferencia de las URL firmadas, que traen una clave nueva cada
// vez), así el navegador guarda la foto y no la vuelve a pedir a Supabase.
// `w` = ancho de la miniatura (la ruta la achica); sin `w`, la foto completa.

export const PHOTO_BUCKETS = ["inspection-photos", "employee-photos", "contractor-photos", "inventory-photos"] as const;
export type PhotoBucket = (typeof PHOTO_BUCKETS)[number];

/** Ancho de las miniaturas (tarjetas, listas): nítidas en pantallas retina hasta ~120 px. */
export const THUMB_WIDTH = 240;

export function photoUrl(bucket: PhotoBucket, path: string, width?: number): string {
  const p = path.split("/").map(encodeURIComponent).join("/");
  return `/api/foto/${bucket}/${p}${width ? `?w=${width}` : ""}`;
}
