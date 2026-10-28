import { NextResponse } from "next/server";

import { dispatchPendingPush } from "@/lib/notifications/push";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 });
  try {
    return NextResponse.json({ sent: await dispatchPendingPush() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
