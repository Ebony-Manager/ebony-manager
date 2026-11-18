// Run from any directory: node scripts/generate-splash.mjs
// Imágenes nativas de inicio del iPhone/iPad (public/splash). Son la primera mitad de la pantalla de
// inicio; la segunda es <StartupSplash> (src/components/brand/startup-splash.tsx + .startup-splash* en
// globals.css). Las medidas tienen que ser LAS MISMAS en los dos lados, o el logo salta al pasar de una a
// otra: logo de min(200, 50 % del ancho) puntos con su centro en el centro de la pantalla; «MANAGER» de
// 0.044 × ese ancho de alto, 0.07 × debajo del logo; rayita de carga de 0.6 × ese ancho, 0.48 × debajo del
// logo (aquí quieta, en la app se mueve).
//
// «MANAGER» viene como trazo en src/lib/splash-art.json (Inter Medium, espaciado 0.32 em). Para cambiar el
// texto, regenerarlo con fontTools desde Inter (ver la historia de ese archivo) — no se usa una fuente aquí.
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import screens from "../src/lib/pwa-screens.json" with { type: "json" };
import art from "../src/lib/splash-art.json" with { type: "json" };

const source = await readFile(new URL("../src/components/brand/ebony-logo.tsx", import.meta.url), "utf8");
const viewBox = source.match(/const WORDMARK_VIEWBOX = "([^"]+)"/)?.[1];
const path = source.match(/const WORDMARK_PATH =\s*"([^"]+)"/)?.[1];
if (!viewBox || !path) throw new Error("Ebony wordmark vector not found");
const [, , vw, vh] = viewBox.split(" ").map(Number);
const [, , sw, sh] = art.viewBox.split(" ").map(Number);

// Los colores del tema (globals.css: --background, --foreground, --muted-foreground, --muted) en hex,
// para que el login y la app sigan sin cambio de color.
const THEMES = {
  light: { background: "#fdfdff", foreground: "#0d0d12", muted: "#62627a", track: "#e2e2ee" },
  dark: { background: "#090a0b", foreground: "#f1f3f9", muted: "#a1abb5", track: "#1a1d23" },
};

const directory = new URL("../public/splash/", import.meta.url);
await mkdir(directory, { recursive: true });
let count = 0;
for (const [width, height, scale] of screens) {
  for (const orientation of ["portrait", "landscape"]) {
    const pw = orientation === "portrait" ? width : height; // ancho en puntos (CSS px)
    const ph = orientation === "portrait" ? height : width;
    const W = Math.min(200, pw * 0.5);
    const logoH = (W * vh) / vw;
    const subH = W * 0.044;
    const subW = (subH * sw) / sh;
    const logoX = (pw - W) / 2;
    const logoY = (ph - logoH) / 2;
    const subY = logoY + logoH + W * 0.07;
    const barW = W * 0.6;
    const barX = (pw - barW) / 2;
    const barY = logoY + logoH + W * 0.48;
    for (const [theme, c] of Object.entries(THEMES)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw * scale}" height="${ph * scale}" viewBox="0 0 ${pw} ${ph}">
<rect width="100%" height="100%" fill="${c.background}"/>
<svg x="${logoX}" y="${logoY}" width="${W}" height="${logoH}" viewBox="${viewBox}"><path fill="${c.foreground}" d="${path}"/></svg>
<svg x="${(pw - subW) / 2}" y="${subY}" width="${subW}" height="${subH}" viewBox="${art.viewBox}"><path fill="${c.muted}" d="${art.path}"/></svg>
<rect x="${barX}" y="${barY}" width="${barW}" height="3" rx="1.5" fill="${c.track}"/>
<rect x="${barX}" y="${barY}" width="${barW * 0.4}" height="3" rx="1.5" fill="${c.foreground}"/>
</svg>`;
      const target = new URL(`${width}x${height}@${scale}-${orientation}-${theme}.png`, directory);
      await sharp(Buffer.from(svg)).png({ palette: true, compressionLevel: 9 }).toFile(target.pathname);
      count++;
    }
  }
}
console.log(`Generated ${count} native Apple startup images.`);
