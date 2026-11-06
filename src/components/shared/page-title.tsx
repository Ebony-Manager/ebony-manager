"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useLang } from "@/context/language-context";
import { joinTitle, routeTitleParts } from "@/lib/page-title";

/**
 * El nombre de la pestaña del navegador ("COT-2640 Teo Zebede · Cotización",
 * "Pagos · Personal"), para reconocer cada pestaña con varias abiertas.
 *
 * `RouteTitle` (en el shell) pone el de la sección; una pantalla con nombre
 * propio (una cotización, un proyecto, una persona) lo reemplaza con
 * `usePageTitle`. El que manda queda guardado en `desired` y un observador
 * lo repone si algo más (Next al navegar) cambia el <title>.
 */

const specific = new Map<string, string>();
let desired: string | null = null;
let observer: MutationObserver | null = null;

function apply(title: string) {
  desired = title;
  if (document.title !== title) document.title = title;
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => {
      if (desired && document.title !== desired) document.title = desired;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
  }
}

/** Nombre propio de la pantalla (partes vacías se omiten; `dirty` = ● delante). */
export function usePageTitle(parts: readonly (string | null | undefined | false)[], dirty = false) {
  const pathname = usePathname();
  const title = joinTitle(parts, dirty);
  React.useEffect(() => {
    specific.set(pathname, title);
    apply(title);
  }, [pathname, title]);
  React.useEffect(
    () => () => {
      specific.delete(pathname);
    },
    [pathname]
  );
}

/** El nombre de la sección, salvo que la pantalla ponga el suyo. */
export function RouteTitle() {
  const pathname = usePathname();
  const { lang } = useLang();
  React.useEffect(() => {
    const own = specific.get(pathname);
    apply(own ?? joinTitle(routeTitleParts(pathname, lang)));
  }, [pathname, lang]);
  return null;
}
