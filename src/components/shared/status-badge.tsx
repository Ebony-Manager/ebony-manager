import { Badge } from "@/components/ui/badge";
import { STATUS, type StatusKey, type StatusTone } from "@/lib/ui/status";

const VARIANT: Record<StatusTone, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  ok: "success",
  warn: "warning",
  error: "destructive",
  info: "secondary",
  muted: "outline",
};

/** La etiqueta de un estado: su ícono, su tono y el texto que se le pasa (ver lib/ui/status.ts). */
export function StatusBadge({ status, children }: { status: StatusKey; children: React.ReactNode }) {
  const { icon: Icon, tone } = STATUS[status];
  return (
    <Badge variant={VARIANT[tone]}>
      <Icon className="size-3" />
      {children}
    </Badge>
  );
}
