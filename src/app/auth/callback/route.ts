import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth redirect target. Google sends the user back here with `?code=...`;
 * we exchange it for a session (cookies written via the server client) and
 * forward to `next` (defaults to the app entry route).
 *
 * If the code exchange fails — including the allow-list trigger rejecting a
 * non-authorized Google account at signup — we send the user to
 * /auth/auth-code-error.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/cotizacion";
  const safeNext = next.startsWith("/") ? next : "/cotizacion";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
