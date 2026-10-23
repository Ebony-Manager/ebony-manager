import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly — without it Turbopack walks up
  // looking for a lockfile and can land on an unrelated one further up
  // this machine's directory tree (outside this git repo), which prints
  // a spurious warning on every build.
  turbopack: {
    root: import.meta.dirname,
  },
  // El indicador de desarrollo va por defecto abajo a la izquierda, justo
  // encima del acceso al perfil del rail (user-menu.tsx). Solo existe con
  // `next dev`.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
