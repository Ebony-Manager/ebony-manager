import type { ReactNode } from "react";
import { EbonyLogo, EbonyMark } from "./ebony-logo";

/**
 * Marco de las pantallas de acceso (login, confirmación del enlace de
 * invitación, error de acceso): la marca arriba (el logotipo completo en el
 * login, el círculo con la "n" en las demás), título y subtítulo, y el
 * contenido en una tarjeta. Todo con tokens del tema, así sigue al modo
 * oscuro igual que el resto de la app.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  logo = "mark",
}: {
  logo?: "mark" | "wordmark";
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {logo === "wordmark" ? <EbonyLogo variant="wordmark" tone="black" height={44} /> : <EbonyMark size={56} />}
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>
        {footer && <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
