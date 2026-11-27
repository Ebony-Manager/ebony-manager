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

/** Archivos de compras (cotización o factura de un pedido especial): bucket privado, se abren con enlace firmado. */
export const PURCHASE_DOCS_BUCKET = "purchase-docs";

/** Ruta del archivo de una solicitud (conserva la extensión). */
export function requestDocPath(id: string, fileName: string): string {
  const ext = (fileName.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  return `requests/${id}-${Date.now()}.${ext}`;
}

/** Foto de una solicitud de compra (lo especial que se pide). */
export function requestPhotoPath(id: string, ext = "jpg"): string {
  return `requests/${id}-${Date.now()}.${ext}`;
}

/** Foto de algo guardado para un proyecto (Almacén → Guardado por proyecto). */
export function storedPhotoPath(id: string, ext = "jpg"): string {
  return `stored/${id}-${Date.now()}.${ext}`;
}
