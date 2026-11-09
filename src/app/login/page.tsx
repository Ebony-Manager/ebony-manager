import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { homePathFor } from "@/lib/auth/modules";
import { LoginForm } from "./login-form";

/**
 * Public route. If there's already a verified session with access to the
 * app (a profile), skip the form and go straight to the user's home module.
 * A session without a profile (removed from Usuarios) gets the form, so it
 * can switch to another account. proxy.ts lets /login through.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // `?next=`: volver ahí después de entrar (ej. autorizar una herramienta de IA). Solo rutas internas.
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const profile = await getProfile();
  if (profile) redirect(safeNext ?? homePathFor());

  return <LoginForm next={safeNext} />;
}
