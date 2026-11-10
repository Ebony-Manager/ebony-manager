import { Label } from "@/components/ui/label";

/** Campo etiquetado para los diálogos de Contratistas — mismo patrón que
 *  el `Field` local de Planilla. */
export function Field({
  label,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** "opcional" al lado del título (en vez de escribirlo dentro del campo). */
  optional?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">
        {label}
        {optional && <span className="font-normal opacity-70">· {optional}</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
