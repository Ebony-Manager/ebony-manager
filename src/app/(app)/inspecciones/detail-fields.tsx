"use client";

import { Shapes, type LucideIcon } from "lucide-react";
import { Field } from "@/components/shared/field";
import { ICON } from "@/lib/ui/concepts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { InspectionItem, InspectionKind, InspectionPainter, InspectionResponsible } from "@/types/inspections";
import { useTi, type InspeccionesKey } from "./shared";

// Tipo (pintura / carpintería / otro), pintor y responsable de un detalle:
// los campos (al crear y editar), las etiquetas de la tarjeta y la línea del PDF.

export interface DetailMeta {
  kind: InspectionKind | null;
  painterId: string | null;
  responsible: InspectionResponsible;
  thirdParty: string | null;
}

export const EMPTY_META: DetailMeta = { kind: null, painterId: null, responsible: "ebony", thirdParty: null };

export const KIND_KEY: Record<InspectionKind, InspeccionesKey> = { pintura: "kind_pintura", carpinteria: "kind_carpinteria", otro: "kind_otro" };
/** El ícono de cada tipo (el mismo en los filtros de toda Inspecciones). */
export const KIND_ICON: Record<InspectionKind, LucideIcon> = { pintura: ICON.pintura, carpinteria: ICON.ebanista, otro: Shapes };

/** Botones de a uno (más rápidos que un desplegable en el celular). */
function Choice<T extends string>({ value, options, onChange, size = "md" }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tipo, pintor (si es de pintura) y responsable (con quién, si es un tercero). */
export function DetailFields({
  value,
  onChange,
  painters,
  size = "md",
  painterError,
}: {
  value: DetailMeta;
  onChange: (v: DetailMeta) => void;
  painters: InspectionPainter[];
  size?: "sm" | "md";
  /** «Elige el pintor»: se marca en el campo (no en un aviso). */
  painterError?: string;
}) {
  const { ti } = useTi();
  const set = (patch: Partial<DetailMeta>) => onChange({ ...value, ...patch });
  const active = painters.filter((p) => p.active || p.id === value.painterId);
  return (
    <div className="flex flex-col gap-2.5">
      <Field label={ti("f_kind")}>
        <Choice size={size} value={value.kind} onChange={(kind) => set({ kind })} options={(["pintura", "carpinteria", "otro"] as const).map((k) => ({ value: k, label: ti(KIND_KEY[k]) }))} />
      </Field>
      {value.kind === "pintura" && (
        <Field label={ti("f_painter")} required error={painterError}>
          <Select value={value.painterId ?? ""} onValueChange={(painterId) => set({ painterId })}>
            <SelectTrigger className={cn("w-full", size === "sm" ? "h-8 text-xs" : "h-9")}>
              <SelectValue placeholder={ti("pick_painter")} />
            </SelectTrigger>
            <SelectContent>
              {active.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label={ti("f_responsible")}>
        <Choice
          size={size}
          value={value.responsible}
          onChange={(responsible) => set({ responsible })}
          options={[
            { value: "ebony", label: ti("resp_ebony") },
            { value: "pintor", label: ti("resp_pintor") },
            { value: "tercero", label: ti("resp_tercero") },
          ]}
        />
      </Field>
      {value.responsible === "tercero" && (
        <Field label={ti("f_third_party")}>
          <Input
            value={value.thirdParty ?? ""}
            onChange={(e) => set({ thirdParty: e.target.value })}
            placeholder={ti("third_party_ph")}
            className={size === "sm" ? "h-8 text-xs" : "h-9"}
          />
        </Field>
      )}
    </div>
  );
}

const KIND_TONE: Record<InspectionKind, string> = {
  pintura: "bg-primary/10 text-primary",
  carpinteria: "bg-warning/15 text-warning",
  otro: "bg-muted text-muted-foreground",
};

/** Etiquetas chicas de la tarjeta: tipo, pintor y tercero. */
export function DetailTags({ item, className }: { item: Pick<InspectionItem, "kind" | "painterName" | "responsible" | "thirdParty">; className?: string }) {
  const { ti } = useTi();
  const tag = "inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-[10.5px] font-medium leading-none";
  if (!item.kind && item.responsible === "ebony") return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {item.kind && <span className={cn(tag, KIND_TONE[item.kind])}>{ti(KIND_KEY[item.kind])}</span>}
      {item.kind === "pintura" && item.painterName && <span className={cn(tag, "bg-muted text-foreground")}>{item.painterName}</span>}
      {item.responsible === "pintor" && <span className={cn(tag, "bg-warning/15 text-warning")}>{`${ti("f_responsible")}: ${ti("resp_pintor")}`}</span>}
      {item.responsible === "tercero" && (
        <span className={cn(tag, "bg-destructive/12 text-destructive")}>
          {ti("resp_tercero")}
          {item.thirdParty ? `: ${item.thirdParty}` : ""}
        </span>
      )}
    </div>
  );
}

/** La misma información en una línea de texto (PDF). */
export function useDetailLine() {
  const { ti } = useTi();
  return (item: Pick<InspectionItem, "kind" | "painterName" | "responsible" | "thirdParty">) =>
    [
      item.kind ? ti(KIND_KEY[item.kind]) : null,
      item.kind === "pintura" && item.painterName ? `${ti("f_painter")}: ${item.painterName}` : null,
      // Quién responde, siempre y en tono neutro (el PDF lo lee el pintor).
      `${ti("f_responsible")}: ${item.responsible === "tercero" ? `${ti("resp_tercero")}${item.thirdParty ? ` (${item.thirdParty})` : ""}` : ti(item.responsible === "pintor" ? "resp_pintor" : "resp_ebony")}`,
    ]
      .filter(Boolean)
      .join(" · ");
}
