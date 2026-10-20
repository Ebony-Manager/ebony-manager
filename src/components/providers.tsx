"use client";

import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/context/language-context";
import { AuthProvider, type EbonyUser } from "@/context/auth-context";
import type { AppModule, AppRole } from "@/lib/auth/modules";

export function Providers({
  children,
  initialUser = null,
  initialRole = null,
  initialModules,
}: {
  children: ReactNode;
  initialUser?: EbonyUser | null;
  initialRole?: AppRole | null;
  initialModules?: AppModule[];
}) {
  return (
    <LanguageProvider>
      <AuthProvider initialUser={initialUser} initialRole={initialRole} initialModules={initialModules}>
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
