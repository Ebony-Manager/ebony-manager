import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { INVENTORY_PHOTOS_BUCKET } from "@/lib/almacen/photos";

// Borra del bucket del Almacén las fotos que ya no usa ningún producto (ej. de
// productos eliminados antes de que "Eliminar producto" borrara su foto). Solo
// admin. Sin `?confirmar=1` solo muestra la lista de lo que borraría.
export async function GET(request: Request) {
  await requireAdmin();
  const confirm = new URL(request.url).searchParams.get("confirmar") === "1";
  const supabase = await createClient();

  const { data: items, error } = await supabase.from("inventory_items").select("photo_path");
  if (error) return new Response(error.message, { status: 500 });
  const used = new Set((items ?? []).map((i) => i.photo_path).filter(Boolean));

  const { data: files, error: listError } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).list("items", { limit: 1000 });
  if (listError) return new Response(listError.message, { status: 500 });
  const orphans = (files ?? []).map((f) => `items/${f.name}`).filter((path) => !used.has(path));

  if (!confirm) {
    return Response.json({ sin_producto: orphans.length, fotos: orphans, uso: "Abre esta dirección con ?confirmar=1 para borrarlas." });
  }
  if (orphans.length === 0) return Response.json({ borradas: 0 });
  const { data: removed, error: removeError } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove(orphans);
  if (removeError) return new Response(removeError.message, { status: 500 });
  return Response.json({ borradas: removed?.length ?? 0 });
}
