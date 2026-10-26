import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// Paths that must stay reachable without a session.
// /api/jotform: el webhook de JotForm, sin sesión (se autentica con su token).
// /api/almacen/resumen-diario: el cron de Vercel, sin sesión (se autentica con
// CRON_SECRET; sin él la ruta pide admin).
const PUBLIC_PREFIXES = ["/login", "/auth", "/style-check", "/api/jotform", "/api/almacen/resumen-diario"];

/**
 * Runs on every request (see proxy.ts). Two jobs:
 *   1. Refresh the Supabase session cookies so Server Components downstream
 *      see a valid session — skip this and users get logged out at random.
 *   2. Optimistic gate: if there's no user and the path isn't public,
 *      redirect to /login. This is a first filter, not the last line of
 *      defense — the real checks live in the (app) layout / DAL and in
 *      Postgres RLS.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT: no code between createServerClient and getUser() — a stray
  // await here is a classic cause of random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse unchanged so the refreshed cookies
  // reach the browser. If you build a different response, copy its cookies
  // over first.
  return supabaseResponse;
}
