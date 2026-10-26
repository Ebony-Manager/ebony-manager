"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

type Listener = (running: boolean) => void;
const listeners = new Set<Listener>();

/** Muestra la barra de carga de arriba (ej. al refrescar los datos). `done()` la termina. */
export function startProgress(): () => void {
  listeners.forEach((l) => l(true));
  return () => listeners.forEach((l) => l(false));
}

/** ¿El clic es en un link interno que lleva a otra pantalla? */
function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Barra fina arriba de la pantalla mientras carga la siguiente pantalla (o
 * se refrescan los datos): avanza rápido al principio, se va frenando, y al
 * llegar la pantalla se completa y desaparece. Así un toque nunca queda "sin
 * respuesta" aunque la red esté lenta.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = React.useState<number | null>(null);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimers = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (safety.current) clearTimeout(safety.current);
    timer.current = null;
    safety.current = null;
  }, []);

  const finish = React.useCallback(() => {
    stopTimers();
    setProgress((p) => (p === null ? null : 1));
    setTimeout(() => setProgress((p) => (p === 1 ? null : p)), 250);
  }, [stopTimers]);

  const start = React.useCallback(() => {
    stopTimers();
    setProgress(0.08);
    timer.current = setInterval(() => setProgress((p) => (p === null ? p : p + (0.9 - p) * 0.08)), 200);
    // Por si la pantalla nunca cambia (ej. el link era a la misma página): no dejar la barra colgada.
    safety.current = setTimeout(finish, 15000);
  }, [stopTimers, finish]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };
    const listener: Listener = (running) => (running ? start() : finish());
    document.addEventListener("click", onClick, true);
    listeners.add(listener);
    return () => {
      document.removeEventListener("click", onClick, true);
      listeners.delete(listener);
      stopTimers();
    };
  }, [start, finish, stopTimers]);

  // Llegó la pantalla nueva: se completa la barra.
  React.useEffect(() => {
    const id = requestAnimationFrame(finish);
    return () => cancelAnimationFrame(id);
  }, [pathname, finish]);

  const { lang } = useLang();

  if (progress === null) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] pt-[env(safe-area-inset-top)]"
      role="progressbar"
      aria-label={t(lang, strings.nav.loading)}
    >
      <div
        className="h-[3px] rounded-r-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress * 100}%`, opacity: progress >= 1 ? 0 : 1 }}
      />
    </div>
  );
}
