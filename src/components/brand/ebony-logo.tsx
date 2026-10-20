import { cn } from "@/lib/utils";

type Variant = "wordmark" | "isotipo";
type Tone = "white" | "black" | "walnut" | "inverse";

/**
 * The real Ebony mark — both variants are now genuine vectors (inline
 * SVG, `fill="currentColor"`), the real Bezier path data from Teofilo's
 * original source file (`Logotipo_Ebony_RGB.ai`, extracted with
 * PyMuPDF's `get_drawings()` per letter group, not a raster trace), so
 * it's pixel-for-pixel the designer's own curves, sharp at any size, and
 * recolors via CSS instead of needing a separate PNG per tone.
 *
 * `isotipo` turned out to BE the "n" from "ebony" (confirmed: its real
 * bounding box is 106.221×129.128 in the .ai, aspect ratio 0.823 — the
 * old `isotipo-*.png` files were 1121×1364, aspect ratio 0.822, same
 * shape) — so it's the exact same letter subpath as `wordmark`, just its
 * own tight viewBox instead of the word's. The old isotipo PNGs are no
 * longer referenced anywhere (see grep in the commit that replaced this).
 *
 * `TONE_CLASS` maps each tone to the text-color utility that becomes
 * `currentColor` — same map for both variants.
 */
const TONE_CLASS: Record<Tone, string> = {
  white: "text-white",
  black: "text-ink-900",
  walnut: "text-walnut",
  // Color del fondo de la página: blanco en modo claro, negro en oscuro —
  // para ir sobre un fondo del color del texto (ver EbonyMark).
  inverse: "text-background",
};

const WORDMARK_VIEWBOX = "243.398 522.853 713.205 191.048";
const WORDMARK_PATH =
  "M264.827,581.079 C268.787,556.941 287.387,540.725 311.109,540.725 C334.53,540.725 352.48,557.363 354.762,581.19 L354.936,583.012 L264.511,583.012 L264.827,581.079 M352.89,622.029 C342.34,635.221 328.535,641.91 311.864,641.91 C287.543,641.91 269.091,626.278 264.853,602.079 L264.511,600.128 L374.54,600.128 C374.798,598.051 375.042,593.768 375.042,591.319 C375.042,551.647 348.26,522.853 311.361,522.853 C272.615,522.853 243.398,552.287 243.398,591.319 C243.398,630.496 272.724,660.036 311.612,660.036 C333.702,660.036 352.066,651.071 364.725,634.111 L352.89,622.029 Z M608.197,641.91 C580.632,641.91 560.625,620.633 560.625,591.318 C560.625,562.002 580.632,540.725 608.197,540.725 C635.91,540.725 656.023,562.002 656.023,591.318 C656.023,620.633 635.91,641.91 608.197,641.91 M608.197,522.853 C569.31,522.853 539.985,552.287 539.985,591.318 C539.985,631.137 568.673,660.035 608.197,660.035 C647.086,660.035 676.411,630.496 676.411,591.318 C676.411,552.287 647.086,522.853 608.197,522.853 Z M812.605,656.008 L812.605,526.88 L706.384,526.88 L706.384,656.008 L726.521,656.008 L726.521,559.877 C726.521,551.385 733.406,544.501 741.898,544.501 L776.684,544.501 C785.401,544.501 792.468,551.567 792.468,560.285 L792.468,656.008 L812.605,656.008 Z M956.602,526.881 L936.465,526.881 L936.465,606.423 C936.465,626.135 922.905,639.899 903.492,639.899 C884.074,639.899 870.514,626.135 870.514,606.423 L870.514,526.881 L850.377,526.881 L850.377,606.674 C850.377,636.574 870.809,658.276 898.961,658.276 C921.049,658.276 930.556,648.539 933.617,644.351 L936.873,639.904 L936.625,645.409 C936.53,647.507 936.465,649.84 936.465,652.484 L936.465,681.007 C936.465,689.305 929.739,696.031 921.441,696.031 L863.218,696.031 L863.218,713.901 L956.602,713.901 L956.602,526.881 Z M497.317,618.734 C497.317,630.703 488.545,639.067 475.984,639.067 L432.487,639.067 C424.029,639.067 417.173,632.211 417.173,623.753 L417.173,613.799 C417.173,605.386 423.992,598.568 432.405,598.568 L476.983,598.568 C488.384,598.568 497.317,607.424 497.317,618.734 M417.173,557.938 C417.173,549.756 423.804,543.125 431.985,543.125 L473.651,543.125 C485.82,543.125 494.319,551.145 494.319,562.626 C494.319,573.373 485.679,581.791 474.651,581.791 L433.153,581.791 C424.327,581.791 417.173,574.635 417.173,565.81 L417.173,557.938 M475.151,526.182 L398.566,526.182 L398.566,656.008 L477.481,656.008 C499.586,656.008 516.255,640.774 516.255,620.568 C516.255,607.294 510.086,596.23 499.331,590.214 L496.97,588.896 L499.211,587.383 C507.904,581.515 513.093,571.576 513.093,560.794 C513.093,540.74 497.137,526.182 475.151,526.182 Z";

// Bounding box de la "n" sola, dentro del mismo arte — es un subpath del
// wordmark de arriba (el tercero), reusado tal cual con su propio
// viewBox recortado en vez de duplicar los números.
const ISOTIPO_VIEWBOX = "706.384 526.88 106.221 129.128";
const ISOTIPO_PATH =
  "M812.605,656.008 L812.605,526.88 L706.384,526.88 L706.384,656.008 L726.521,656.008 L726.521,559.877 C726.521,551.385 733.406,544.501 741.898,544.501 L776.684,544.501 C785.401,544.501 792.468,551.567 792.468,560.285 L792.468,656.008 L812.605,656.008 Z";

export interface EbonyLogoProps {
  variant: Variant;
  tone: Tone;
  /** Rendered height in pixels — width follows the mark's own aspect ratio. */
  height: number;
  className?: string;
  alt?: string;
}

export function EbonyLogo({ variant, tone, height, className, alt = "Ebony" }: EbonyLogoProps) {
  const viewBox = variant === "wordmark" ? WORDMARK_VIEWBOX : ISOTIPO_VIEWBOX;
  const path = variant === "wordmark" ? WORDMARK_PATH : ISOTIPO_PATH;
  return (
    <svg
      viewBox={viewBox}
      style={{ height, width: "auto" }}
      className={cn(TONE_CLASS[tone], className)}
      role="img"
      aria-label={alt}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/**
 * La marca para el chrome de la app: la "n" sobre un círculo del color del
 * texto — negro con la "n" blanca en modo claro, y al revés en oscuro, así
 * nunca se pierde contra el fondo. Va arriba del rail y en las pantallas de
 * acceso (login, confirmación, error).
 */
export function EbonyMark({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-foreground", className)}
      style={{ width: size, height: size }}
    >
      <EbonyLogo variant="isotipo" tone="inverse" height={Math.round(size * 0.46)} />
    </div>
  );
}
