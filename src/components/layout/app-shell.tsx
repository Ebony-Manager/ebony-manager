"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type PendingCounts } from "@/components/layout/sidebar";
import { MobileBottomNav, MobileTopBar } from "@/components/layout/mobile-nav";
import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { NavigationProgress } from "@/components/layout/navigation-progress";

/**
 * Client chrome for the protected area. Desktop: the rail on the left, no
 * top bar — the profile/language/sign-out menu lives at the bottom of the
 * rail (user-menu.tsx). Mobile (< md): a top bar with the section (and its
 * tabs), a bottom tab bar with the modules, and "Más" opens the whole menu
 * (with names) plus the profile preferences as a bottom sheet. The content scrolls inside <PullToRefresh> (pull down to
 * refresh). The auth gate itself lives in the (app) server layout.
 */
export function AppShell({ children, pending }: { children: React.ReactNode; pending: PendingCounts }) {
  const pathname = usePathname();
  // "Más" queda abierto solo en la ruta donde se abrió: al navegar se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === pathname;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <NavigationProgress />
      {/* En celular el rail no se usa (isOpen siempre false): lo reemplazan las barras y "Más". */}
      <Sidebar isOpen={false} onClose={() => setOpenAt(null)} pending={pending} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileTopBar pending={pending} />
        <PullToRefresh className="flex-1 overflow-y-auto pb-[var(--app-bottom)]">{children}</PullToRefresh>
        <MobileBottomNav pending={pending} onOpenMenu={() => setOpenAt(pathname)} />
        <MobileMoreSheet open={moreOpen} onClose={() => setOpenAt(null)} pending={pending} />
      </div>
    </div>
  );
}
