"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { haptic } from "@/lib/haptics";

const TRIGGER = 64; // px que hay que jalar para refrescar
const MAX = 96;

/** ¿Algún contenedor entre el dedo y `root` ya está desplazado hacia abajo? Entonces el gesto es para él. */
function innerScrolled(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== root) {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * El área desplazable de la app con "jalar hacia abajo para refrescar", como
 * en las apps del teléfono: con la pantalla arriba del todo, se jala con el
 * dedo y, al soltar pasado el umbral, se vuelven a pedir los datos
 * (router.refresh(): sin recargar la página ni perder lo escrito). El
 * navegador no lo hace solo porque la pantalla se desplaza dentro de este
 * contenedor, no en la página. Solo con el dedo; en computadora no hace nada.
 */
export function PullToRefresh({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLElement>(null);
  const router = useRouter();
  const [pull, setPull] = React.useState(0);
  const [refreshing, startRefresh] = React.useTransition();
  const pullRef = React.useRef(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;

    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || el.scrollTop > 0 || innerScrolled(e.target, el)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      decided = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        // Hacia arriba o de lado (tablas que se deslizan): no es para refrescar.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || el.scrollTop > 0) {
          tracking = false;
          return;
        }
      }
      if (dy <= 0) return set(0);
      if (e.cancelable) e.preventDefault();
      // Resistencia: cuesta más mientras más se jala.
      const next = Math.min(MAX, dy * 0.5);
      // Un toquecito al pasar el umbral: "suelta y refresca".
      if (next >= TRIGGER && pullRef.current < TRIGGER) haptic(10);
      set(next);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pullRef.current >= TRIGGER) startRefresh(() => router.refresh());
      set(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const shown = refreshing ? TRIGGER * 0.75 : pull;
  const ready = pull >= TRIGGER;

  return (
    <main ref={ref} className={`relative overscroll-y-contain ${className ?? ""}`}>
      <div aria-hidden={!refreshing} className="pointer-events-none sticky top-0 z-30 flex h-0 justify-center" style={{ opacity: shown > 8 ? 1 : 0 }}>
        <span
          className="mt-2 flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md"
          style={{ transform: `translateY(${shown * 0.6}px)`, transition: pull ? "none" : "transform 0.2s, opacity 0.2s" }}
        >
          <RefreshCw
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${(pull / TRIGGER) * 270}deg)`, opacity: ready ? 1 : 0.6 }}
          />
        </span>
      </div>
      {/* El contenido no se mueve: un transform aquí descolocaría las barras fijas de las pantallas (ej. el carrito de Salidas). */}
      {children}
    </main>
  );
}
