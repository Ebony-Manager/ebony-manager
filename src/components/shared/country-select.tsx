"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { countryName, countryOptions } from "@/lib/countries";

/**
 * Nacionalidad: se elige un país de la lista (con buscador), los más
 * frecuentes arriba. Guarda el código ISO ("PA"); `null` = sin especificar.
 * Un valor viejo que no es código se muestra tal cual hasta que se cambie.
 */
export function CountrySelect({
  value,
  onChange,
  id,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  id?: string;
}) {
  const { lang } = useLang();
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo(() => countryOptions(lang), [lang]);
  const common = options.filter((o) => o.common);
  const rest = options.filter((o) => !o.common);
  const none = t(lang, strings.common.country_none);

  function pick(code: string | null) {
    onChange(code);
    setOpen(false);
  }

  const item = (o: { code: string; name: string }) => (
    <CommandItem key={o.code} value={`${o.name} ${o.code}`} onSelect={() => pick(o.code)}>
      <Check className={cn("size-3.5", value === o.code ? "opacity-100" : "opacity-0")} />
      {o.name}
    </CommandItem>
  );

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? countryName(value, lang) : none}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={t(lang, strings.common.country_search)} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              <CommandItem value={`__none ${none}`} onSelect={() => pick(null)}>
                <Check className={cn("size-3.5", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">{none}</span>
              </CommandItem>
              {common.map(item)}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>{rest.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
