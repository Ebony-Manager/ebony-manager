"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar, type PendingCounts } from "@/components/layout/sidebar";
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
export function AppShell({ children, pending }: { children: React.ReactNode; pending: PendingCounts }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang } = useLang();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} pending={pending} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t(lang, strings.nav.menu)}
            className="relative p-1 text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
          >
            <Menu size={20} />
            {pending.intakes + pending.moneyRequests > 0 && (
              <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-red-600" aria-hidden />
            )}
          </button>
          <EbonyLogo variant="wordmark" tone="black" height={16} />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
