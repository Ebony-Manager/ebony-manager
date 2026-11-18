"use client";

import type { CSSProperties } from "react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import art from "@/lib/splash-art.json";
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/components/brand/ebony-logo";

/**
 * Login con la misma cara que la pantalla de inicio (StartupSplash y las imágenes de public/splash): el
 * logo «ebony» y «MANAGER» en el MISMO lugar y tamaño (ancho min(200px, 50vw), centro en el centro de la
 * pantalla), y donde estaba la rayita de carga aparece el botón de Google. Así, al terminar la pantalla de
 * inicio, no se siente como otra página. Las medidas son las de `.startup-splash*` en globals.css.
 */
export function LoginForm({ next }: { next?: string }) {
  const { signInWithGoogle, loading } = useAuth();
  const { lang, toggle } = useLang();
  const stage = { "--splash-w": "min(200px, 50vw)" } as CSSProperties;

  return (
    <main style={stage} className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      {/* El logo: centro exacto de la pantalla, como en la pantalla de inicio. */}
      <div className="absolute top-1/2 left-1/2 w-[var(--splash-w)] -translate-x-1/2 -translate-y-1/2">
        <h1 className="sr-only">Ebony Manager</h1>
        <svg viewBox={WORDMARK_VIEWBOX} aria-hidden="true" className="block h-[calc(var(--splash-w)*208/730)] w-full">
          <path d={WORDMARK_PATH} fill="currentColor" />
        </svg>
        <svg
          viewBox={art.viewBox}
          aria-hidden="true"
          className="absolute top-[calc(100%+var(--splash-w)*0.07)] left-1/2 h-[calc(var(--splash-w)*0.044)] w-auto -translate-x-1/2 text-muted-foreground"
        >
          <path d={art.path} fill="currentColor" />
        </svg>

        {/* Donde estaba la rayita de carga: el botón de entrar. */}
        <div className="absolute top-[calc(100%+var(--splash-w)*0.40)] left-1/2 flex w-[min(320px,calc(100vw-48px))] -translate-x-1/2 flex-col items-center gap-3">
          <button
            onClick={() => void signInWithGoogle(next)}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="text-center text-xs text-muted-foreground">{t(lang, strings.auth.access_note)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-[calc(24px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {lang === "es" ? "English" : "Español"}
      </button>
    </main>
  );
}
