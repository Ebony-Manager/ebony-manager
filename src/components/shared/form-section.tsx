import * as React from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Un grupo de campos de un formulario, con su ícono y título: lo que va junto
 * se ve junto ("¿Para quién?", "Proyecto", "Seguimiento") en vez de una lista
 * plana de campos del mismo peso. `quiet` = lo secundario (ya viene con
 * valores puestos o es opcional): fondo tenue, para que lo principal resalte.
 */
export function FormSection({
  icon: Icon,
  title,
  note,
  error,
  quiet = false,
  action,
  className,
  children,
}: {
  /** Botón a la derecha del título (ej. "Agregar contacto"). */
  action?: React.ReactNode;
  icon: LucideIcon;
  title: string;
  /** Aclaración corta al lado del título (ej. "al menos uno"). */
  note?: string;
  /** Falla de todo el grupo (ej. "elige al menos uno"): se ve en rojo bajo el título. */
  error?: string;
  quiet?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const longNote = (note?.length ?? 0) > 40;
  return (
    <section className={cn("flex flex-col gap-3", quiet && "rounded-xl bg-muted/50 p-3.5", className)}>
      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-foreground">
        <Icon className={cn("size-4 shrink-0", quiet ? "text-muted-foreground" : "text-primary")} />
        {title}
        {note && !longNote && <span className="min-w-0 text-xs font-normal text-muted-foreground">· {note}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </h3>
      {/* Una aclaración larga no cabe al lado del título: va debajo, como una línea normal. */}
      {note && longNote && <p className="-mt-1.5 text-xs text-muted-foreground">{note}</p>}
      {error && (
        <p role="alert" className="-mt-1.5 flex items-center gap-1 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {children}
    </section>
  );
}

/** Un campo de texto con su ícono adentro (ubicación, teléfono, correo…): se reconoce sin leer el título. */
export function WithIcon({ icon: Icon, className, children }: { icon: LucideIcon; className?: string; children: React.ReactElement<{ className?: string }> }) {
  return (
    <div className={cn("relative", className)}>
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      {React.cloneElement(children, { className: cn(children.props.className, "pl-9") })}
    </div>
  );
}
