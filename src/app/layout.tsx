import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ebony Manager",
  description: "Sistema de gestión para Ebony Custom Woodwork.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Google Identity Services — loaded globally because AuthProvider
            (inside Providers, used app-wide) needs window.google to init
            its token client, not just the /login route. */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
