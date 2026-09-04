"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

/**
 * Auth gate for every real module route. Today's auth is a pure
 * client-side token (Google Identity Services + sessionStorage, see
 * auth-context.tsx) — there's no server session/cookie to protect this
 * with middleware, so the gate has to run client-side, same as the old
 * Vite version's `if (!user) return <Login/>`. It now redirects to a real
 * /login route instead of swapping in a component inline.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-ebony-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ebony-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ebony-warm">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
