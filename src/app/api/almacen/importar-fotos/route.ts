import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EGRESOS_FORM_ID, images, toProducts } from "@/lib/almacen/jotform-products";
import { INVENTORY_PHOTOS_BUCKET, inventoryPhotoPath } from "@/lib/almacen/photos";

// Copia una sola vez las fotos de los productos del JotForm "Egreso de
// Suministros" al bucket del Almacén. Solo admin. Salta los productos que ya
// tienen foto (con `?todas=1` las vuelve a copiar). Un producto que une varios
// del JotForm (ej. Tornillo #6) toma la primera foto que encuentre.
const JOTFORM_API = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";
export const maxDuration = 60;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function GET(request: Request) {
  await requireAdmin();
  const apiKey = process.env.JOTFORM_API_KEY?.trim();
  if (!apiKey) return new Response("Falta JOTFORM_API_KEY en el servidor.", { status: 500 });
  const all = new URL(request.url).searchParams.get("todas") === "1";

  const res = await fetch(`${JOTFORM_API}/form/${EGRESOS_FORM_ID}/properties`, { headers: { APIKEY: apiKey }, cache: "no-store" });
  if (!res.ok) return new Response(`JotForm respondió ${res.status}.`, { status: 502 });
  const props = ((await res.json()) as { content?: Record<string, unknown> }).content ?? {};
  const photoByPid = new Map<string, string>();
  for (const p of toProducts(props.products)) {
    const [first] = images(p.images);
    if (first) photoByPid.set(String(p.pid), first);
  }

  const supabase = await createClient();
  const { data: items, error } = await supabase.from("inventory_items").select("id, name, jotform_pid, photo_path");
  if (error) return new Response(error.message, { status: 500 });

  const todo = (items ?? []).filter((i) => i.jotform_pid && (all || !i.photo_path));
  const result = { copiadas: [] as string[], sin_foto_en_jotform: [] as string[], errores: [] as string[] };

  async function copy(item: (typeof todo)[number]) {
    const url = item.jotform_pid!.split(",").map((pid) => photoByPid.get(pid.trim())).find(Boolean);
    if (!url) return result.sin_foto_en_jotform.push(item.name);
    try {
      const img = await fetch(encodeURI(decodeURI(url)), { cache: "no-store" });
      const type = (img.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!img.ok || !EXT[type]) throw new Error(`respuesta ${img.status} ${type}`);
      const path = inventoryPhotoPath(item.id, EXT[type]);
      const up = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, await img.arrayBuffer(), { contentType: type });
      if (up.error) throw up.error;
      const upd = await supabase.from("inventory_items").update({ photo_path: path }).eq("id", item.id);
      if (upd.error) throw upd.error;
      if (item.photo_path) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([item.photo_path]);
      result.copiadas.push(item.name);
    } catch (err) {
      result.errores.push(`${item.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // De a 8 en paralelo para no pasarse del tiempo de la función.
  for (let i = 0; i < todo.length; i += 8) await Promise.all(todo.slice(i, i + 8).map(copy));

  return Response.json({
    resumen: `${result.copiadas.length} fotos copiadas, ${result.sin_foto_en_jotform.length} productos sin foto en JotForm, ${result.errores.length} errores.`,
    ...result,
  });
}
