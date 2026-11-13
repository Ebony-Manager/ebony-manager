"use client";

import { X } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DesignerCandidate } from "@/types/designers";

/**
 * Escoger varias diseñadoras de Ebony (personas de Personal): las elegidas salen como fichas con una X y el
 * resto se agrega desde la lista. Controlado: el padre guarda los ids.
 */
export function DesignerPick({
  value,
  onChange,
  candidates,
  labels,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  candidates: DesignerCandidate[];
  labels: { add: string; none: string; remove: string };
}) {
  const options = candidates.filter((c) => !value.includes(c.id));
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <li key={id} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-sm">
              <span className="font-medium text-foreground">{nameOf(id)}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== id))}
                aria-label={labels.remove}
                title={labels.remove}
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.none}</p>
      )}
      {options.length > 0 && (
        <Select value="" onValueChange={(v) => onChange([...value, v])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={labels.add} />
          </SelectTrigger>
          <SelectContent>
            {options.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.position ? ` · ${c.position}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
