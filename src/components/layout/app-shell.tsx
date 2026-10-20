"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { EbonyLogo } from "@/components/brand/ebony-logo";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/**
 * Client chrome for the protected area: sidebar + the mobile open/close
 * state. No top bar on desktop — the profile/language/sign-out menu lives at
 * the bottom of the rail (user-menu.tsx). On mobile the rail is hidden, so a
 * slim strip with the menu button is the only way to open it. The auth gate
 * itself lives in the (app) server layout that renders this.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang } = useLang();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-900/8 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t(lang, strings.nav.menu)}
            className="p-1 text-ink-900/60 transition-colors hover:text-ink-900"
          >
            <Menu size={20} />
          </button>
          <EbonyLogo variant="wordmark" tone="walnut" height={16} />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
