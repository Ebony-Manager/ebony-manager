import Image from "next/image";

type Variant = "wordmark" | "isotipo";
type Tone = "white" | "black";

/**
 * The real Ebony mark — never redrawn, never type standing in for it.
 * Follows the pattern of `_diseño-ebony-fuente/components/brand/Logo.jsx`
 * (design-system reference only, not imported directly — its assets/ isn't
 * shipped, see the root .gitignore), adapted to `next/image` over the PNGs
 * copied into `public/brand/`.
 *
 * `next/image` needs the asset's real pixel size to reserve the right
 * aspect ratio; the actual rendered size then comes from `height` + the
 * `width: "auto"` style override below (the "known intrinsic size, keep
 * aspect ratio" pattern from the Next.js Image docs) — so callers only
 * ever pick a height, never distort the mark.
 */
const ASSETS: Record<Variant, Partial<Record<Tone, { file: string; width: number; height: number }>>> = {
  wordmark: {
    white: { file: "logo-wordmark-white.png", width: 3020, height: 886 },
    black: { file: "logo-wordmark-black.png", width: 3161, height: 1067 },
  },
  isotipo: {
    white: { file: "isotipo-white.png", width: 5001, height: 5001 },
    black: { file: "isotipo-black.png", width: 1121, height: 1364 },
  },
};

export interface EbonyLogoProps {
  variant: Variant;
  tone: Tone;
  /** Rendered height in pixels — width follows the asset's own aspect ratio. */
  height: number;
  className?: string;
  alt?: string;
}

export function EbonyLogo({ variant, tone, height, className, alt = "Ebony" }: EbonyLogoProps) {
  const byTone = ASSETS[variant];
  // Falls back to whichever tone of this variant IS shipped, rather than
  // rendering nothing — e.g. wordmark/black isn't copied to public/brand/
  // yet (not asked for), so a future call with that combo still shows the
  // real mark instead of a blank space.
  const asset = byTone[tone] ?? Object.values(byTone)[0];
  if (!asset) return null;
  return (
    <Image
      src={`/brand/${asset.file}`}
      alt={alt}
      width={asset.width}
      height={asset.height}
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}
