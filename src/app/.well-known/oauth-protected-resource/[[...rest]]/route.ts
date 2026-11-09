import { appOrigin, supabaseAuthIssuer } from "@/lib/mcp/auth";

/**
 * Metadatos del recurso protegido (RFC 9728) del MCP: dicen a la
 * herramienta de IA que los tokens los emite Supabase Auth. Responde en
 * /.well-known/oauth-protected-resource y en .../api/mcp.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(
    {
      resource: `${appOrigin(request)}/api/mcp`,
      authorization_servers: [supabaseAuthIssuer()],
      bearer_methods_supported: ["header"],
      resource_name: "Ebony Manager",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } }
  );
}
