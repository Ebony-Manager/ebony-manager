"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";

import type { Client, ClientKind, Stage } from "@/types/ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SubTabs } from "@/components/shared/page-header";
import { STAGE_TONE } from "@/lib/ventas/opportunities";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type VentasKey = keyof typeof strings.ventas;

/** Textos de Ventas en el idioma actual, con {n} / {t}… reemplazados. */
export function useTv() {
  const { lang } = useLang();
  const tv = React.useCallback(
    (k: VentasKey, vars?: Record<string, string | number>) => {
      let s = t(lang, strings.ventas[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    [lang],
  );
  return { tv, lang };
}

export const SEGUIMIENTO_PATH = "/cotizacion/seguimiento";
export const CLIENTES_PATH = "/cotizacion/clientes";

/** Seguimiento · Cotizaciones · Clientes: las tres pantallas de Cotización. */
export function CotizacionTabs({ value }: { value: "seguimiento" | "cotizaciones" | "clientes" }) {
  const { tv } = useTv();
  const router = useRouter();
  const href = { seguimiento: SEGUIMIENTO_PATH, cotizaciones: "/cotizacion", clientes: CLIENTES_PATH } as const;
  return (
    <SubTabs
      value={value}
      onChange={(v) => router.push(href[v])}
      tabs={[
        { value: "seguimiento", label: tv("tab_seguimiento") },
        { value: "cotizaciones", label: tv("tab_cotizaciones") },
        { value: "clientes", label: tv("tab_clientes") },
      ]}
    />
  );
}

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const { tv } = useTv();
  return (
    <Badge variant={STAGE_TONE[stage]} className={className}>
      {tv(`stage_${stage}`)}
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: ClientKind }) {
  const { tv } = useTv();
  return <Badge variant={kind === "arquitecto" ? "secondary" : "outline"}>{tv(`kind_${kind}_short`)}</Badge>;
}

/**
 * Elegir un cliente de un tipo (arquitecto o cliente final) con búsqueda; si
 * no existe, "Crear «Nombre»" lo crea ahí mismo (onCreate) sin salir de la ficha.
 */
export function ClientPicker({
  clients,
  kind,
  value,
  onChange,
  onCreate,
  placeholder,
  disabled,
}: {
  clients: Client[];
  kind: ClientKind;
  value: string | null;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  placeholder: string;
  disabled?: boolean;
}) {
  const { tv } = useTv();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const options = clients.filter((c) => c.kind === kind && (c.active || c.id === value));
  const picked = clients.find((c) => c.id === value);
  const exact = options.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase());

  async function create() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    await onCreate(name);
    setCreating(false);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal">
          <span className={cn("truncate", !picked && "text-muted-foreground")}>{picked ? picked.name : placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{query.trim() ? null : tv("no_results")}</CommandEmpty>
            <CommandGroup>
              {options.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.company ?? ""} ${c.id}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", c.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{c.name}</span>
                    {c.company && <span className="truncate text-xs text-muted-foreground">{c.company}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {query.trim() && !exact && (
              <CommandGroup>
                <CommandItem value={`__crear__ ${query}`} onSelect={() => void create()} disabled={creating}>
                  <Plus className="size-4" />
                  {tv("create_new_named", { n: query.trim() })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
