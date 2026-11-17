// Capturas de la app en producción con la cuenta auditor (solo mirar, nunca guardar).
// Ver AUDITOR-PLAN.md → «Acceso visual».
//
// Uso (desde la raíz del repo):
//   ANON=<clave anon del conector de Supabase> AUDITOR_PW=<contraseña recién puesta> \
//     node scripts/capturas.mjs <carpeta-salida> /almacen/salidas /directorio ...
// Saca, por ruta, una captura de teléfono (390 px) y otra de escritorio (1440 px).
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const SUPABASE_URL = "https://jdfkfbopecqvvyxherku.supabase.co";
const APP = "https://admin.ebonypanama.com";
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
  secure: true,
  sameSite: "Lax",
}));

const browser = await chromium.launch();
const sizes = [
  ["tel", { width: 390, height: 844 }],
  ["esc", { width: 1440, height: 900 }],
];
for (const [tag, viewport] of sizes) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "es-PA" });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  for (const route of routes) {
    const res = await page.goto(APP + route, { waitUntil: "networkidle", timeout: 60000 });
    const file = `${outDir}/${route.replace(/\W+/g, "_")}-${tag}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(tag, route, res?.status(), page.url(), "→", file);
  }
  await ctx.close();
}
await browser.close();
