import art from "@/lib/splash-art.json";
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "./ebony-logo";

/**
 * Pantalla de inicio (solo con la app instalada): «ebony» grande en el centro, «MANAGER» debajo y una
 * rayita que se mueve mientras cargan los datos. Sin JavaScript, sin descargar fuentes ni tiempo mínimo.
 *
 * Tiene que coincidir con las imágenes nativas del iPhone (public/splash, scripts/generate-splash.mjs):
 * mismo tamaño y lugar del logo y del texto, para que al pasar de una a otra nada salte. Las medidas
 * están en las clases `.startup-splash*` de globals.css y repetidas en el script; si se cambian, en los dos.
 */
export function StartupSplash() {
  return (
    <div className="startup-splash" role="status" aria-label="Cargando Ebony">
      <div className="startup-splash-brand">
        <svg className="startup-splash-logo" viewBox={WORDMARK_VIEWBOX} aria-hidden="true">
          <path d={WORDMARK_PATH} fill="currentColor" />
        </svg>
        <svg className="startup-splash-sub" viewBox={art.viewBox} aria-hidden="true">
          <path d={art.path} fill="currentColor" />
        </svg>
        <div className="startup-splash-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
