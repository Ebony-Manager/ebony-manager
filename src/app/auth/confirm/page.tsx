"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";

/**
 * Adónde llega el enlace del correo de invitación (ver
 * `sendInvitation` en src/services/app-users.ts). Acepta las dos formas en
 * que Supabase puede mandar la sesión:
 *   - `#access_token=…&refresh_token=…` — la plantilla de correo por
 *     defecto (flujo implícito). El hash no llega al servidor, por eso esta
 *     página es de cliente; el cliente del navegador está en PKCE y no lo
 *     toma solo, así que se guarda a mano con `setSession`.
 *   - `?token_hash=…&type=…` — si la plantilla se cambia al formato
 *     recomendado para SSR (ver SETUP.md).
 * Con la sesión ya en cookies, una navegación completa a `/` deja que el
 * servidor mande a cada quien a su primer módulo.
 */
export default function AuthConfirmPage() {
  const { lang } = useLang();
  const [failed, setFailed] = useState(false);
  // Un enlace de un solo uso: que el doble efecto de StrictMode no lo gaste dos veces.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const supabase = createClient();
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));

    async function confirm(): Promise<boolean> {
      if (hash.get("error") || query.get("error")) return false;

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        return !error;
      }

      const tokenHash = query.get("token_hash");
      const type = query.get("type") as EmailOtpType | null;
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        return !error;
      }
      return false;
    }

    void confirm().then((ok) => {
      if (ok) window.location.replace("/");
      else setFailed(true);
    });
  }, []);

  return (
    <div className="min-h-screen bg-ebony-dark flex flex-col items-center justify-center px-4">
      <div className="bg-ebony-warm rounded-none shadow-2xl p-10 w-full max-w-sm text-center space-y-5">
        <div className="mx-auto flex h-14 items-center justify-center">
          <EbonyLogo variant="isotipo" tone="black" height={28} />
        </div>
        {failed ? (
          <>
            <p className="text-sm text-ebony-dark">{t(lang, strings.auth.confirm_failed)}</p>
            <Link
              href="/login"
              className="inline-block w-full bg-ebony-dark text-cream-100 rounded-none px-4 py-3 text-sm font-medium hover:bg-ebony-medium transition-colors"
            >
              {t(lang, strings.auth.back_to_login)}
            </Link>
          </>
        ) : (
          <p className="text-sm text-ebony-light">{t(lang, strings.auth.confirming)}</p>
        )}
      </div>
    </div>
  );
}
