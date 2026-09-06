"use client";

import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/context/language-context";
import { AuthProvider, type EbonyUser } from "@/context/auth-context";
import type { AppRole } from "@/lib/auth/dal";

export function Providers({
  children,
  initialUser = null,
  initialRole = null,
}: {
  children: ReactNode;
  initialUser?: EbonyUser | null;
  initialRole?: AppRole | null;
}) {
  return (
    <LanguageProvider>
      <AuthProvider initialUser={initialUser} initialRole={initialRole}>
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
