import type { MetadataRoute } from "next";

/**
 * Manifiesto de la app instalable (PWA): con esto "Agregar a pantalla de
 * inicio" la abre a pantalla completa, sin la barra del navegador, con su
 * ícono y nombre. Los íconos salen de src/app/icon.svg (public/icons/).
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
    orientation: "portrait",
    lang: "es",
    background_color: "#fcfcfd",
    theme_color: "#fcfcfd",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
