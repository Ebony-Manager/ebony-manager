// Run from any directory: node scripts/generate-splash.mjs
// Rasterize the existing brand vector; no network, fonts or runtime work.
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import screens from "../src/lib/pwa-screens.json" with { type: "json" };

const source = await readFile(new URL("../src/components/brand/ebony-logo.tsx", import.meta.url), "utf8");
const viewBox = source.match(/const WORDMARK_VIEWBOX = "([^"]+)"/)?.[1];
const path = source.match(/const WORDMARK_PATH =\s*"([^"]+)"/)?.[1];
if (!viewBox || !path) throw new Error("Ebony wordmark vector not found");
const [, , vw, vh] = viewBox.split(" ").map(Number);
const directory = new URL("../public/splash/", import.meta.url);
await mkdir(directory, { recursive: true });
let count = 0;
for (const [width, height, scale] of screens) {
  for (const orientation of ["portrait", "landscape"]) {
    const w = (orientation === "portrait" ? width : height) * scale;
    const h = (orientation === "portrait" ? height : width) * scale;
    const logoWidth = Math.min(width * 0.5, 220) * scale;
    const logoHeight = logoWidth * vh / vw;
    for (const theme of ["light", "dark"]) {
      const background = theme === "dark" ? "#141618" : "#D8D5CF";
      const foreground = theme === "dark" ? "#D8D5CF" : "#030605";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${background}"/><svg x="${(w-logoWidth)/2}" y="${(h-logoHeight)/2}" width="${logoWidth}" height="${logoHeight}" viewBox="${viewBox}"><path fill="${foreground}" d="${path}"/></svg></svg>`;
      const target = new URL(`${width}x${height}@${scale}-${orientation}-${theme}.png`, directory);
      await sharp(Buffer.from(svg)).png({ palette: true, compressionLevel: 9 }).toFile(target.pathname);
      count++;
    }
  }
}
console.log(`Generated ${count} native Apple startup images.`);
