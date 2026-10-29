// Fotos del catálogo del Almacén: bucket público `inventory-photos` (sin
// firmar URLs). Cada foto nueva lleva su propio nombre, así el navegador no
// muestra una vieja en caché.

export const INVENTORY_PHOTOS_BUCKET = "inventory-photos";

export function inventoryPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${INVENTORY_PHOTOS_BUCKET}/${path}`;
}

export function inventoryPhotoPath(itemId: string, ext = "jpg"): string {
  return `items/${itemId}-${Date.now()}.${ext}`;
}

export function toolPhotoPath(toolId: string, ext = "jpg"): string {
  return `tools/${toolId}-${Date.now()}.${ext}`;
}
