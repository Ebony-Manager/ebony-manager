// Run from any directory: node scripts/generate-icons.mjs
// Íconos de la app (iPhone, Android, pestaña del navegador), hechos desde cero y nítidos: la «n» de Ebony
// (el isotipo del logo, mismas proporciones que src/components/brand/ebony-logo.tsx) se vuelve a dibujar
// para CADA tamaño con sus bordes rectos en píxeles enteros, así no quedan columnas grises (lo borroso).
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Proporciones del isotipo original (Logotipo_Ebony_RGB.ai): ancho 106.221, alto 129.128, palo 20.137,
// barra de arriba 17.621, curva interior ~15.5.
const N = { w: 106.221, h: 129.128, stem: 20.137, top: 17.621, r: 15.5 };

export const THEMES = {
  light: { bg: "#fdfdff", fg: "#0d0d12" },
  dark: { bg: "#0d0d12", fg: "#fdfdff" },
};

/** La «n» de alto `fill` × tamaño, centrada, con los bordes rectos en píxeles enteros. */
export function iconSvg(size, { bg, fg }, fill = 0.56, radius = 0) {
  const H = Math.round(size * fill);
  const k = H / N.h;
  const W = Math.round(N.w * k);
  const stem = Math.max(1, Math.round(N.stem * k));
  const top = Math.max(1, Math.round(N.top * k));
  const r = Math.min(N.r * k, (W - 2 * stem) / 2, H - top);
  const x0 = Math.round((size - W) / 2);
  const y0 = Math.round((size - H) / 2);
  const x1 = x0 + W, y1 = y0 + H, xi0 = x0 + stem, xi1 = x1 - stem, yi = y0 + top;
  const d = `M${x0} ${y1}V${y0}H${x1}V${y1}H${xi1}V${yi + r}A${r} ${r} 0 0 0 ${xi1 - r} ${yi}H${xi0 + r}A${r} ${r} 0 0 0 ${xi0} ${yi + r}V${y1}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/><path fill="${fg}" d="${d}"/></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const theme = THEMES[process.env.ICON_THEME ?? "dark"];
  const png = (size, fill = 0.56) => sharp(Buffer.from(iconSvg(size, theme, fill))).png({ compressionLevel: 9 }).toBuffer();
  const root = new URL("../", import.meta.url);
  await mkdir(new URL("public/icons/", root), { recursive: true });
  // iPhone: 180 (Apple recorta las esquinas solo).
  await writeFile(new URL("src/app/apple-icon.png", root), await png(180));
  // Android / instalación: 192 y 512; «maskable» con la «n» más chica (Android recorta un círculo).
  await writeFile(new URL("public/icons/icon-192.png", root), await png(192));
  await writeFile(new URL("public/icons/icon-512.png", root), await png(512));
  await writeFile(new URL("public/icons/icon-maskable-512.png", root), await png(512, 0.44));
  // Pestaña del navegador: el SVG (cualquier tamaño) con esquinas redondeadas.
  await writeFile(new URL("src/app/icon.svg", root), iconSvg(512, theme, 0.6, 112) + "\n");
  console.log("Íconos generados.");
}
