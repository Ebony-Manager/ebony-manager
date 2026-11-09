import { redirect } from "next/navigation";

import { AuthShell } from "@/components/brand/auth-shell";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { decideAuthorization } from "./actions";

/**
 * Pantalla de autorización de una herramienta de IA (Claude, ChatGPT,
 * Cursor…) que quiere consultar Ebony Manager por MCP. Supabase Auth (OAuth
 * 2.1 Server) manda aquí con `?authorization_id=`. Sin sesión, pasa por el
 * login y vuelve. La herramienta queda con los MISMOS permisos de la persona.
 */
export const dynamic = "force-dynamic";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) {
    return (
      <AuthShell title="Falta la solicitud" subtitle="Vuelve a conectar desde la herramienta de IA.">
        <p className="text-sm text-muted-foreground">El enlace llegó sin el identificador de la autorización.</p>
      </AuthShell>
    );
  }

  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return (
      <AuthShell title="No se pudo cargar la solicitud" subtitle="Puede que haya vencido. Vuelve a conectar desde la herramienta de IA.">
        <p className="text-sm text-muted-foreground">{error?.message ?? "Solicitud no encontrada."}</p>
      </AuthShell>
    );
  }
  // Ya la había autorizado antes: vuelve directo a la herramienta.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const client = data.client;
  return (
    <AuthShell title={`¿Autorizas a ${client.name || "esta aplicación"}?`} subtitle="Quiere conectarse a Ebony Manager con tu cuenta.">
      <div className="flex flex-col gap-4 text-sm">
        <div className="rounded-md bg-muted/50 px-3 py-2.5">
          <p className="font-medium text-foreground">{client.name || "Aplicación sin nombre"}</p>
          {client.uri && <p className="truncate text-xs text-muted-foreground">{client.uri}</p>}
        </div>
        <div className="flex flex-col gap-1.5 text-muted-foreground">
          <p>
            Podrá usar Ebony Manager en tu nombre, con tus mismos permisos ({data.user.email}):
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Contratistas: consultar saldos, estados de cuenta, contratos, abonos, préstamos y tarifas.</li>
            <li>Crear contratos y registrar abonos, siempre mostrándote antes una vista previa para que confirmes.</li>
          </ul>
          <p>No puede borrar nada. Cada consulta y cada cambio quedan anotados.</p>
        </div>
        <form action={decideAuthorization} className="flex gap-2">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button
            type="submit"
            name="decision"
            value="deny"
            className="h-10 flex-1 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-accent"
          >
            Rechazar
          </button>
          <button type="submit" name="decision" value="approve" className="h-10 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Autorizar
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
