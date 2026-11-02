import sharp from "sharp";

import { PHOTO_BUCKETS, type PhotoBucket } from "@/lib/photo-url";
import { createClient } from "@/lib/supabase/server";

// Una foto privada con dirección fija (ver src/lib/photo-url.ts). La baja de
// Supabase con la sesión de quien la ve: las reglas del bucket deciden (sin
// sesión o sin permiso, no hay foto). Como cada foto nunca cambia (cada una tiene su propia ruta), el
// navegador la guarda un año y no la vuelve a pedir: así no se gasta el
// tráfico de Supabase cada vez que se recarga una pantalla. `?w=240` = miniatura.
export const dynamic = "force-dynamic";

const ONE_YEAR = "private, max-age=31536000, immutable";

export async function GET(request: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;
  if (!PHOTO_BUCKETS.includes(bucket as PhotoBucket)) return new Response("No encontrado", { status: 404 });
  const objectPath = path.map(decodeURIComponent).join("/");
  if (!objectPath || objectPath.includes("..")) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) return new Response("No encontrado", { status: 404 });

  const width = Number(new URL(request.url).searchParams.get("w"));
  if (width >= 32 && width <= 1600) {
    try {
      const small = await sharp(Buffer.from(await data.arrayBuffer()))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
      return new Response(new Uint8Array(small), { headers: { "Content-Type": "image/jpeg", "Cache-Control": ONE_YEAR } });
    } catch {
      // Si no se puede achicar, se manda la original.
    }
  }
  return new Response(data, { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": ONE_YEAR } });
}
