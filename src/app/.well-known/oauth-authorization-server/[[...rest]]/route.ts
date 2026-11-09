/**
 * Algunas herramientas de IA buscan los metadatos OAuth en la dirección de
 * la app en vez de en la de Supabase: se devuelven los de Supabase Auth
 * (el servidor que de verdad emite los tokens).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/.well-known/oauth-authorization-server/auth/v1`, { cache: "no-store" });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
