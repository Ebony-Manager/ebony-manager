"use client";

import * as React from "react";
import { BellRing, Send, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { VAPID_PUBLIC_KEY } from "@/lib/notifications/config";

type State = "checking" | "unsupported" | "needs-install" | "blocked" | "off" | "on" | "unconfigured";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PushControls() {
  const { lang } = useLang();
  const tn = (key: keyof typeof strings.notificaciones) => t(lang, strings.notificaciones[key]);
  const [state, setState] = React.useState<State>("checking");
  const [busy, setBusy] = React.useState(false);
  const publicKey = VAPID_PUBLIC_KEY;

  const inspect = React.useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (isIos() && !isStandalone()) return setState("needs-install");
    if (!publicKey) return setState("unconfigured");
    if (Notification.permission === "denied") return setState("blocked");
    const registration = await navigator.serviceWorker.register("/sw.js");
    setState((await registration.pushManager.getSubscription()) ? "on" : "off");
  }, [publicKey]);

  /* eslint-disable react-hooks/set-state-in-effect -- inspección asíncrona de APIs del navegador al montar. */
  React.useEffect(() => {
    void inspect();
  }, [inspect]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) }));
      const response = await fetch("/api/notifications/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "Error");
      setState("on");
      toast.success(tn("push_enabled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications/subscription", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      toast.success(tn("push_disabled"));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/test", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Error");
      toast.success(tn("push_test_sent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const message =
    state === "on"
      ? tn("push_on_hint")
      : state === "needs-install"
        ? tn("push_install_hint")
        : state === "blocked"
          ? tn("push_blocked_hint")
          : state === "unconfigured"
            ? tn("push_server_hint")
            : state === "unsupported"
              ? tn("push_unsupported_hint")
              : tn("push_off_hint");

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-walnut" />
        <div>
          <h2 className="font-semibold">{tn("push_title")}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button size="sm" onClick={() => void enable()} disabled={busy}>
            <BellRing className="size-3.5" />
            {tn("push_enable")}
          </Button>
        )}
        {state === "on" && (
          <>
            <Button size="sm" variant="outline" onClick={() => void test()} disabled={busy}>
              <Send className="size-3.5" />
              {tn("push_test")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void disable()} disabled={busy}>
              {tn("push_disable")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
