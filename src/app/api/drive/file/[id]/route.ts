import { getProfile } from "@/lib/auth/dal";
import { hasModule, isDesignerView, type AppModule } from "@/lib/auth/modules";
import { downloadFile, downloadThumbnail, getItem } from "@/lib/google/drive";

// Ver un archivo de Drive dentro de la app (imagen, PDF, video): la app lo
// trae con su llave y lo pasa tal cual. `?thumb=1` = la miniatura.
// Para quien ve Ventas, Proyectos o Diseño (esta última sin la carpeta COTIZACION, que trae precios).
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  const staff = !!profile && (["cotizacion", "proyectos", "contratistas"] as AppModule[]).some((m) => hasModule(profile, m));
  const designer = !!profile && isDesignerView(profile);
  if (!staff && !designer) return new Response("Sin permiso", { status: 403 });
  const { id } = await params;
  if (!staff) {
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) return new Response("Sin permiso", { status: 403 });
  }
  try {
    const item = await getItem(id);
    // La diseñadora no abre la carpeta COTIZACION (PDF con precios) ni su contenido directo.
    if (!staff && (item.name.trim().toUpperCase() === "COTIZACION" || (item.parentId && (await getItem(item.parentId)).name.trim().toUpperCase() === "COTIZACION")))
      return new Response("Sin permiso", { status: 403 });
    if (new URL(request.url).searchParams.get("thumb") === "1") {
      if (!item.thumbnailLink) return new Response("Sin miniatura", { status: 404 });
      const thumb = await downloadThumbnail(item.thumbnailLink);
      return new Response(thumb.body, {
        headers: { "Content-Type": thumb.headers.get("content-type") ?? "image/png", "Cache-Control": "private, max-age=3600" },
      });
    }
    if (item.isFolder || item.mimeType.startsWith("application/vnd.google-apps")) return new Response("No se puede descargar", { status: 415 });
    const file = await downloadFile(id);
    return new Response(file.body, {
      headers: {
        "Content-Type": item.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
        ...(item.size ? { "Content-Length": String(item.size) } : {}),
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Error", { status: 502 });
  }
}
