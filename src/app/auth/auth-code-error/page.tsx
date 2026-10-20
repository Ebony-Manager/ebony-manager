import Link from "next/link";

/**
 * Where sign-in lands when it fails or the account has no access. Most
 * common: a Google account whose email is not in public.allowed_emails (the
 * signup trigger rejects it), or a user removed from Administración →
 * Usuarios (their profile is gone, so requireProfile() sends them here).
 */
export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-ebony-dark flex flex-col items-center justify-center px-4">
      <div className="bg-ebony-warm rounded-none shadow-2xl p-10 w-full max-w-sm text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-none bg-ebony-dark flex items-center justify-center">
          <span className="text-cream-100 font-black text-xl">!</span>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-ebony-dark">No se pudo iniciar sesión</h1>
          <p className="text-xs text-ebony-light">
            Tu cuenta no está autorizada para entrar a Ebony Manager, o el enlace
            de acceso expiró. Si crees que deberías tener acceso, pide a un
            administrador que te invite desde Administración → Usuarios.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block w-full bg-ebony-dark text-cream-100 rounded-none px-4 py-3 text-sm font-medium hover:bg-ebony-medium transition-colors"
        >
          Volver a intentar
        </Link>
      </div>
    </div>
  );
}
