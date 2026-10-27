import { Suspense } from "react";
import { StartupSplash } from "@/components/brand/startup-splash";
import type { Metadata, Viewport } from "next";
import { Inter, Merriweather, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { getUser, getProfile } from "@/lib/auth/dal";
import type { EbonyUser } from "@/context/auth-context";
import type { AppModule, AppRole } from "@/lib/auth/dal";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { appleStartupImages } from "@/lib/pwa";
import "./globals.css";

// Tipografías del tema (tweakcn): Inter para toda la interfaz, Merriweather
// (serif) y JetBrains Mono disponibles como font-serif / font-mono. Las
// variables las lee @theme inline en globals.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ebony Manager",
  description: "Sistema de gestión para Ebony Custom Woodwork.",
  applicationName: "Ebony Manager",
  // Instalada en el iPhone (Compartir → Agregar a inicio) abre a pantalla
  // completa, como app. El manifiesto (manifest.ts) hace lo mismo en Android.
  appleWebApp: { capable: true, title: "Ebony", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// viewportFit "cover": la app usa toda la pantalla y respeta la muesca y la
// barra de gestos con env(safe-area-inset-*). El color de la barra del
// sistema sigue al tema claro / oscuro.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#141618" },
  ],
};

async function SessionProviders({ children }: { children: React.ReactNode }) {
  // Seed the client AuthProvider from the verified server session so the
  // shell (profile menu, role-gated bits) renders right on first paint,
  // with no logged-out flash.
  const [user, profile] = await Promise.all([getUser(), getProfile()]);

  const initialUser: EbonyUser | null = user
    ? {
        name:
          profile?.full_name ||
          (user.user_metadata?.full_name as string | undefined) ||
          user.email ||
          "Usuario",
        email: profile?.email || user.email || "",
        picture:
          profile?.avatar_url ||
          (user.user_metadata?.avatar_url as string | undefined) ||
          (user.user_metadata?.picture as string | undefined),
      }
    : null;
  const initialRole: AppRole | null = profile?.role ?? null;
  const initialModules: AppModule[] | undefined = profile?.modules;

  return (
    <Providers initialUser={initialUser} initialRole={initialRole} initialModules={initialModules}>
      {children}
    </Providers>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT pone `.dark` en <html>
    // antes de hidratar, así que su className puede diferir del servidor.
    <html
      lang="es"
      className={`${inter.variable} ${merriweather.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {appleStartupImages.map(({ url, media }) => (
          <link key={url} rel="apple-touch-startup-image" href={url} media={media} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <Suspense fallback={<StartupSplash />}>
          <SessionProviders>{children}</SessionProviders>
        </Suspense>
      </body>
    </html>
  );
}
