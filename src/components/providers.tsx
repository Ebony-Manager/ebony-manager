"use client";

import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/context/language-context";
import { AuthProvider } from "@/context/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--ebony-warm)",
              color: "var(--ebony-dark)",
              border: "1px solid var(--ebony-gray)",
            },
            success: { iconTheme: { primary: "var(--ebony-gold)", secondary: "var(--ebony-warm)" } },
            error: { iconTheme: { primary: "var(--ebony-destructive)", secondary: "var(--ebony-warm)" } },
          }}
        />
      </AuthProvider>
    </LanguageProvider>
  );
}
