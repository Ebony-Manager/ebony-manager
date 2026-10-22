"use client";

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface PickerOption {
  id: string;
  label: string;
  /** Texto chico a la derecha (ej. lo que falta del contrato). */
  hint?: string;
  /** En gris (ej. terminados). */
  muted?: boolean;
}

/**
 * Selector con búsqueda (proyecto, contrato…): grupos de opciones, una
 * opción "ninguno" opcional y "+ crear nuevo" al final.
 */
export function SearchPicker({
  triggerLabel,
  searchPlaceholder,
  emptyText,
  groups,
  onSelect,
  noneLabel,
  createLabel,
  onCreate,
  disabled,
}: {
  triggerLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  groups: { heading?: string; options: PickerOption[] }[];
  onSelect: (id: string | null) => void;
  /** Si viene, primera opción para dejarlo vacío. */
  noneLabel?: string;
  createLabel?: string;
  onCreate?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const pick = (id: string | null) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={disabled}>
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {noneLabel && (
              <CommandGroup>
                <CommandItem value={`${noneLabel} __none__`} onSelect={() => pick(null)}>
                  {noneLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {groups
              .filter((g) => g.options.length > 0)
              .map((g, i) => (
                <CommandGroup key={g.heading ?? i} heading={g.heading}>
                  {g.options.map((o) => (
                    <CommandItem key={o.id} value={`${o.label} ${o.id}`} onSelect={() => pick(o.id)}>
                      <span className={`truncate ${o.muted ? "text-muted-foreground" : ""}`}>{o.label}</span>
                      {o.hint && <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{o.hint}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            {createLabel && onCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`${createLabel} __create__`}
                    onSelect={() => {
                      setOpen(false);
                      onCreate();
                    }}
                  >
                    <Plus className="size-3.5" />
                    {createLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
