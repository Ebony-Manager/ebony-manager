import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/dal";
import { sendPush } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: "Este dispositivo no está suscrito." }, { status: 400 });
  try {
    await Promise.all(
      data.map((s) => sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title: "Ebony Manager", body: "Las notificaciones push están funcionando.", href: "/settings/notificaciones" })),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo enviar" }, { status: 500 });
  }
}
