import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { appOrigin, bearerToken, verifyMcpToken } from "@/lib/mcp/auth";
import { registerContractorTools } from "@/lib/mcp/contractors-tools";
import { registerContractorWriteTools } from "@/lib/mcp/contractors-write-tools";
import { withAccessToken } from "@/lib/supabase/request-token";

/**
 * MCP de Ebony Manager (Streamable HTTP, sin sesión: cada petición es
 * completa). Las herramientas de IA (Claude, ChatGPT, Cursor…) entran con
 * un token OAuth de Supabase Auth: sin token o con uno inválido se responde
 * 401 con la dirección de los metadatos, y el cliente hace solo el inicio de
 * sesión (pantalla /oauth/consent). Todo lo que se consulta pasa por los
 * servicios de la app con el token de esa persona: aplica su RLS y sus
 * módulos. Primera versión: Contratistas, solo consulta.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INSTRUCTIONS =
  "Ebony Manager es el sistema interno de Ebony Custom Woodwork (ebanistería en Panamá). Esta conexión da acceso al módulo de Contratistas: consultar saldos, estados de cuenta, contratos, abonos, préstamos y tarifas, y además crear contratos (por ejemplo, desde una foto o plano con medidas), registrar abonos y agregar movimientos al estado de cuenta (material, gastos, extras, bonos, ajustes). Antes de explicar saldos o contratos, lee la herramienta guia_contratistas. Responde en español, con montos en dólares y fechas concretas; no inventes datos. Para crear o registrar algo, SIEMPRE muestra primero la vista previa y espera a que la persona diga que sí antes de confirmar; si las medidas de una imagen no se leen bien o falta algo, pregunta en vez de suponer.";

function unauthorized(request: Request, reason: string): Response {
  const metadata = `${appOrigin(request)}/.well-known/oauth-protected-resource/api/mcp`;
  return new Response(JSON.stringify({ error: "invalid_token", error_description: reason }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer realm="ebony-manager", error="invalid_token", error_description="${reason}", resource_metadata="${metadata}"`,
    },
  });
}

async function handle(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return unauthorized(request, "Falta el token de acceso");
  const user = await verifyMcpToken(token);
  if (!user) return unauthorized(request, "Token inválido o usuario sin acceso a la app");

  return withAccessToken(token, async () => {
    const server = new McpServer({ name: "ebony-manager", title: "Ebony Manager", version: "1.0.0" }, { instructions: INSTRUCTIONS });
    registerContractorTools(server, user);
    registerContractorWriteTools(server, user);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(request);
  });
}

export { handle as GET, handle as POST, handle as DELETE };
