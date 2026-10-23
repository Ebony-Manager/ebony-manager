"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/brand/auth-shell";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/**
 * Where sign-in lands when it fails or the account has no access. Most
 * common: a Google account whose email is not in public.allowed_emails (the
 * signup trigger rejects it), or a user removed from Settings → Usuarios
 * (their profile is gone, so requireProfile() sends them here).
 */
export default function AuthCodeErrorPage() {
  const { lang } = useLang();
  return (
    <AuthShell title={t(lang, strings.auth.error_title)}>
      <p className="text-sm text-muted-foreground">{t(lang, strings.auth.error_body)}</p>
      <Button asChild className="mt-5 h-11 w-full">
        <Link href="/login">{t(lang, strings.auth.retry)}</Link>
      </Button>
    </AuthShell>
  );
}
