import * as React from "react";
import type { LucideIcon } from "lucide-react";

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
  quiet = false,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Aclaración corta al lado del título (ej. "al menos uno"). */
  note?: string;
  quiet?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3", quiet && "rounded-xl bg-muted/50 p-3.5", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className={cn("size-4", quiet ? "text-muted-foreground" : "text-primary")} />
        {title}
        {note && <span className="text-xs font-normal text-muted-foreground">· {note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Un campo de texto con su ícono adentro (ubicación, teléfono, correo…): se reconoce sin leer el título. */
export function WithIcon({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactElement<{ className?: string }> }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      {React.cloneElement(children, { className: cn(children.props.className, "pl-9") })}
    </div>
  );
}
