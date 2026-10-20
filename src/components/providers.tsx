"use client";

import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/context/language-context";
import { AuthProvider, type EbonyUser } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
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
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider initialUser={initialUser} initialRole={initialRole} initialModules={initialModules}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              },
              success: { iconTheme: { primary: "var(--success)", secondary: "var(--popover)" } },
              error: { iconTheme: { primary: "var(--destructive)", secondary: "var(--popover)" } },
            }}
          />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
