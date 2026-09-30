"use client";

import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";

export function LoginForm() {
  const { signInWithGoogle, loading } = useAuth();
  const { lang, toggle } = useLang();

  return (
    <div className="min-h-screen bg-ebony-dark flex flex-col items-center justify-center px-4">
      <div className="bg-ebony-warm rounded-none shadow-2xl p-10 w-full max-w-sm text-center space-y-6">
        {/* Sin bg-ebony-dark: tone="black" ya es la marca oscura, y esta
            tarjeta (bg-ebony-warm) es clara — un fondo oscuro detrás la
            volvería a tapar, como pasaba con la "E" antes. */}
        <div className="mx-auto flex h-16 items-center justify-center">
          <EbonyLogo variant="isotipo" tone="black" height={28} />
        </div>

        <div>
          <h1 className="text-xl font-bold text-ebony-dark">{t(lang, strings.auth.welcome)}</h1>
          <p className="text-xs text-ebony-light mt-1">{t(lang, strings.auth.subtitle)}</p>
        </div>

        <button
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-ebony-gray rounded-none px-4 py-3 shadow-sm hover:shadow-md transition-shadow font-medium text-ebony-dark text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          {t(lang, strings.auth.signIn)}
        </button>

        <button
          onClick={toggle}
          className="text-xs text-ebony-light hover:text-ebony-medium transition-colors"
        >
          {lang === "es" ? "Switch to English" : "Cambiar a Español"}
        </button>
      </div>

      <p className="text-ebony-gray/20 text-xs mt-6">Ebony Manager v2.0</p>
    </div>
  );
}
