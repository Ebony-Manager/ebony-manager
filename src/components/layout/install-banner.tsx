"use client";

import * as React from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { EbonyMark } from "@/components/brand/ebony-logo";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

// El aviso de Chrome/Android para instalar llega una sola vez y temprano: se
// guarda aquí apenas carga este archivo, para usarlo cuando se toque "Instalar".
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferred: InstallPromptEvent | null = null;
const CHANGE = "ebony-install-change";
const DISMISS_KEY = "ebony.install.dismissedAt";
const DISMISS_DAYS = 30;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    window.dispatchEvent(new Event(CHANGE));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.dispatchEvent(new Event(CHANGE));
  });
}

type Mode = "hidden" | "prompt" | "ios" | "android";

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Qué mostrar: nada si ya es app instalada, en computadora o si se dijo "Ahora no" hace poco. */
function currentMode(): Mode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone || window.matchMedia("(min-width: 768px)").matches || dismissedRecently()) return "hidden";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (deferred) return "prompt";
  return /Android/.test(ua) ? "android" : "hidden";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    mq.removeEventListener("change", onChange);
  };
}

/**
 * Tarjeta flotante abajo (solo celular), como en la mayoría de las páginas,
 * que invita a instalar Ebony Manager como app (abre a pantalla completa, sin
 * la barra del navegador). Sube a los 2 segundos de abrir. En Android con
 * Chrome trae el botón "Instalar" del sistema; en el iPhone, que no lo
 * permite, explica los toques (Compartir → Agregar a pantalla de inicio).
 * "Ahora no" la esconde 30 días; instalada, no vuelve a salir.
 */
export function InstallBanner() {
  const { lang } = useLang();
  const mode = React.useSyncExternalStore(subscribe, currentMode, () => "hidden" as Mode);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (mode === "hidden") return;
    const id = setTimeout(() => setShown(true), 2000);
    return () => clearTimeout(id);
  }, [mode]);

  if (mode === "hidden") return null;

  const later = () => {
    setShown(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sin almacenamiento (modo privado): se esconde solo por ahora.
    }
    setTimeout(() => window.dispatchEvent(new Event(CHANGE)), 250);
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    window.dispatchEvent(new Event(CHANGE));
  };

  const tn = (k: keyof typeof strings.nav) => t(lang, strings.nav[k]);

  return (
    <div
      role="dialog"
      aria-label={tn("install_title")}
      aria-hidden={!shown}
      className={`fixed inset-x-3 bottom-[calc(var(--app-bottom)+0.75rem)] z-30 print:hidden transition-all duration-300 ease-out md:hidden ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <EbonyMark size={40} />
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            <p className="text-[15px] font-semibold text-foreground">{tn("install_title")}</p>
            {mode === "ios" ? (
              <p className="mt-0.5 text-muted-foreground">
                {tn("install_ios_1")}{" "}
                <span className="font-medium whitespace-nowrap text-foreground">
                  <Share className="inline size-3.5 -translate-y-px text-primary" /> {tn("install_share")}
                </span>
                , {tn("install_ios_2")}{" "}
                <span className="font-medium whitespace-nowrap text-foreground">
                  <SquarePlus className="inline size-3.5 -translate-y-px" /> {tn("install_ios_3")}
                </span>
                .
              </p>
            ) : mode === "android" ? (
              <p className="mt-0.5 text-muted-foreground">{tn("install_android")}</p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">{tn("install_body")}</p>
            )}
          </div>
          <button
            type="button"
            onClick={later}
            aria-label={tn("install_later")}
            title={tn("install_later")}
            className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-9" onClick={later}>
            {tn("install_later")}
          </Button>
          {mode === "prompt" && (
            <Button size="sm" className="h-9" onClick={() => void install()}>
              <Download className="size-3.5" />
              {tn("install_btn")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
