// Capturas de la app en producción con la cuenta auditor (solo mirar, nunca guardar).
// Ver AUDITOR-PLAN.md → «Acceso visual».
//
// Uso (desde la raíz del repo):
//   ANON=<clave anon del conector de Supabase> AUDITOR_PW=<contraseña recién puesta> \
//     node scripts/capturas.mjs <carpeta-salida> /almacen/salidas /directorio ...
// Saca, por ruta, una captura de teléfono (390 px) y otra de escritorio (1440 px).
import { createRequire } from "node:module";

// Playwright viene instalado de forma global en la sesión (no está en package.json): `require` sí lo encuentra
// por NODE_PATH; un `import` normal no.
const require = createRequire(import.meta.url);
const { createServerClient } = require("@supabase/ssr");
const { chromium } = require("playwright");

const SUPABASE_URL = "https://jdfkfbopecqvvyxherku.supabase.co";
// APP=http://localhost:3000 para mirar una versión local (next dev) antes de publicar.
const APP = process.env.APP || "https://admin.ebonypanama.com";
const [, , outDir, ...routes] = process.argv;
if (!outDir || !routes.length || !process.env.ANON || !process.env.AUDITOR_PW) {
  console.error("Faltan argumentos: ANON, AUDITOR_PW, carpeta y al menos una ruta.");
  process.exit(1);
}

// Entrar con un frasco de cookies en memoria: así salen las mismas cookies que pone la app.
const jar = new Map();
const sb = createServerClient(SUPABASE_URL, process.env.ANON, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const { error } = await sb.auth.signInWithPassword({
  email: "auditor@ebonypanama.com",
  password: process.env.AUDITOR_PW,
});
if (error) {
  console.error("No se pudo entrar:", error.message);
  process.exit(1);
}
const cookies = [...jar].map(([name, value]) => ({
  name,
  value,
  domain: new URL(APP).hostname,
  path: "/",
  secure: APP.startsWith("https:"),
  sameSite: "Lax",
}));

const browser = await chromium.launch();
// La app se desplaza por dentro (no la página), así que «página completa» no baja: TALL=1 usa una
// ventana muy alta para ver la pantalla entera de una vez.
const tall = !!process.env.TALL;
const sizes = [
  ["tel", { width: 390, height: tall ? 3200 : 844 }],
  ["esc", { width: 1440, height: tall ? 2400 : 900 }],
];
for (const [tag, viewport] of sizes) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "es-PA" });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  for (const route of routes) {
    const res = await page.goto(APP + route, { waitUntil: "networkidle", timeout: 60000 });
    // CLICK=<selector de Playwright> abre algo antes de la captura (ej. un diálogo). Solo abrir: nunca Guardar.
    // Varios clics seguidos: separados por " ;; " (ej. abrir un formulario vacío y tocar Guardar para ver los errores).
    for (const sel of (process.env.CLICK ?? "").split(" ;; ").filter(Boolean)) {
      await page.locator(sel).first().click();
      await page.waitForTimeout(800);
    }
    const file = `${outDir}/${route.replace(/\W+/g, "_")}${process.env.CLICK ? "-click" : ""}-${tag}.png`;
    await page.screenshot({ path: file, fullPage: !process.env.CLICK });
    console.log(tag, route, res?.status(), page.url(), "→", file);
  }
  await ctx.close();
}
await browser.close();
