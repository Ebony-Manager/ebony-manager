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
 * Franja en el celular que invita a instalar Ebony Manager como app (abre a
 * pantalla completa, sin la barra del navegador). En Android con Chrome trae
 * el botón "Instalar" del sistema; en el iPhone, que no lo permite, explica
 * los dos toques (Compartir → Agregar a pantalla de inicio). "Ahora no" la
 * esconde 30 días; instalada, no vuelve a salir.
 */
export function InstallBanner() {
  const { lang } = useLang();
  const mode = React.useSyncExternalStore(subscribe, currentMode, () => "hidden" as Mode);
  if (mode === "hidden") return null;

  const later = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sin almacenamiento (modo privado): se esconde solo por ahora.
    }
    window.dispatchEvent(new Event(CHANGE));
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
    <div className="flex shrink-0 items-start gap-3 border-b border-sidebar-border bg-primary/8 px-4 py-2.5 md:hidden" role="region" aria-label={tn("install_title")}>
      <EbonyMark size={32} className="mt-0.5" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="font-semibold text-foreground">{tn("install_title")}</p>
        {mode === "ios" ? (
          <p className="text-muted-foreground">
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
          <p className="text-muted-foreground">{tn("install_android")}</p>
        ) : (
          <p className="text-muted-foreground">{tn("install_body")}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {mode === "prompt" && (
          <Button size="sm" className="h-8" onClick={() => void install()}>
            <Download className="size-3.5" />
            {tn("install_btn")}
          </Button>
        )}
        <button
          type="button"
          onClick={later}
          aria-label={tn("install_later")}
          title={tn("install_later")}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
