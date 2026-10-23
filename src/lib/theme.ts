// Tema claro / oscuro — lo que comparten el servidor (layout.tsx, que pone
// el script en <head>) y el cliente (context/theme-context.tsx). Sin
// "use client": el layout necesita el texto del script, no una referencia
// de cliente.

export type ThemePref = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "ebony_theme";

/**
 * Script en línea para <head>: aplica la clase `.dark` antes del primer
 * pintado, así no hay parpadeo claro→oscuro al cargar. Misma regla que
 * `applyTheme` en theme-context.tsx — si cambia una, cambia la otra.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
