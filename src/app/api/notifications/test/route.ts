import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/dal";
import { pushErrorText, sendPush } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";

/** "Enviar prueba": manda a cada dispositivo del usuario y dice cuál falló y por qué. */
export async function POST() {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db.from("push_subscriptions").select("endpoint,p256dh,auth,user_agent").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: "Este dispositivo no está suscrito." }, { status: 400 });
  const results = await Promise.all(
    data.map(async (s) => {
      const device = deviceName(s.endpoint, s.user_agent);
      try {
        await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title: "Ebony", body: "Las notificaciones push están funcionando.", href: "/notificaciones" });
        return { device, ok: true as const };
      } catch (err) {
        console.error("Push de prueba falló", device, err);
        return { device, ok: false as const, error: pushErrorText(err) };
      }
    }),
  );
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    return NextResponse.json({ error: failed.map((r) => `${r.device}: ${"error" in r ? r.error : ""}`).join(" · "), results }, { status: 502 });
  }
  return NextResponse.json({ ok: true, results });
}

function deviceName(endpoint: string, ua: string | null): string {
  const host = endpoint.includes("apple.com") ? "Apple" : endpoint.includes("googleapis") ? "Google" : endpoint.includes("mozilla") ? "Firefox" : "Otro";
  const kind = ua?.includes("iPhone") ? "iPhone" : ua?.includes("iPad") ? "iPad" : ua?.includes("Android") ? "Android" : ua?.includes("Mac") ? "Mac" : ua?.includes("Windows") ? "Windows" : "Navegador";
  return `${kind} (${host})`;
}
