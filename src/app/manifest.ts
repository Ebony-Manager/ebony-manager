import type { MetadataRoute } from "next";

/**
 * Manifiesto de la app instalable (PWA): con esto "Agregar a pantalla de
 * inicio" la abre a pantalla completa, sin la barra del navegador, con su
 * ícono y nombre. Los íconos los genera scripts/generate-icons.mjs (ICON_THEME=light).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ebony Manager",
    short_name: "Ebony",
    description: "Sistema de gestión de Ebony Custom Woodwork.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // Sin bloquear: la tablet (y el teléfono) giran; acostada, la tablet usa la forma de computadora.
    orientation: "any",
    lang: "es",
    background_color: "#fdfdff",
    theme_color: "#fdfdff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
