import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

/**
 * Public route. If there's already a verified session, skip the form and
 * go straight to the app. proxy.ts lets /login through without a session.
 */
export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/cotizacion");

  return <LoginForm />;
}
