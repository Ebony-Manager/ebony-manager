import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { getUser, getProfile } from "@/lib/auth/dal";
import type { EbonyUser } from "@/context/auth-context";
import type { AppRole } from "@/lib/auth/dal";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers initialUser={initialUser} initialRole={initialRole}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
