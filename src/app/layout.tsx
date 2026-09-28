import type { Metadata } from "next";
import { Work_Sans, Catamaran } from "next/font/google";
import { Providers } from "@/components/providers";
import { getUser, getProfile } from "@/lib/auth/dal";
import type { EbonyUser } from "@/context/auth-context";
import type { AppRole } from "@/lib/auth/dal";
import "./globals.css";

// Work Sans (titulares/subtítulos/UI/labels) + Catamaran (cuerpo de
// texto) — las dos tipografías reales de la marca (brand guidelines
// p.21, ver _diseño-ebony-fuente/tokens/fonts.css), reemplazando a
// Inter. Work Sans es variable en Google Fonts — sin `weight` carga todo
// el rango (200-600) que pide el sistema; Catamaran no, así que se fija
// la escala de pesos que usa la tipografía de marca (300-600).
const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const catamaran = Catamaran({
  variable: "--font-catamaran",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Ebony Manager",
  description: "Sistema de gestión para Ebony Custom Woodwork.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Seed the client AuthProvider from the verified server session so the
  // shell (Navbar avatar, role-gated bits) renders right on first paint,
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

  return (
    <html lang="es" className={`${workSans.variable} ${catamaran.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers initialUser={initialUser} initialRole={initialRole}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
