import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  const db = await createClient();
  const { error } = await db.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, user_agent: request.headers.get("user-agent") },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  const db = await createClient();
  const { error } = await db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
