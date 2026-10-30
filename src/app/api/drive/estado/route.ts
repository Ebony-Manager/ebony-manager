import { getProfile } from "@/lib/auth/dal";
import { driveDiagnosis } from "@/lib/google/drive";

// Diagnóstico de Google Drive (solo admin): qué variables ve el servidor, si
// el JSON se lee, si Google acepta la llave y si se llega a la Unidad compartida.
// Nunca muestra la llave ni el ID.
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  if (profile?.role !== "admin") return new Response("Solo admin", { status: 403 });
  return Response.json(await driveDiagnosis(), { headers: { "Cache-Control": "no-store" } });
}
