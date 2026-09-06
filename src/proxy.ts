import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the `middleware` file convention to `proxy` (same
// mechanism, runs on the Node.js runtime). This keeps the Supabase session
// fresh on every request and does the optimistic auth redirect.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except:
     * - _next/static, _next/image (build assets)
     * - favicon.ico and common image files
     * Auth needs to run on everything else, including RSC data requests.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
