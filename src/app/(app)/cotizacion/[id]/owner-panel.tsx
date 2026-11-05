"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, Check, ChevronDown, FolderKanban, User, Waypoints } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { linkClients, linkOpportunity, linkProject, type OwnerPatch } from "@/lib/cotizador/owner";
import { cn } from "@/lib/utils";
import { quoteOwnerKind, type Quote, type QuoteOwnerKind, type QuoteOwnerOptions } from "@/types/cotizador";
import type { Client, ClientKind } from "@/types/ventas";
import { ClientPicker, SEGUIMIENTO_PATH, StageBadge, useTv } from "../ventas-common";
import { ClientDialog } from "../clientes/client-dialog";
import type { Stage } from "@/types/ventas";

type Tt = (k: "own_title" | "own_opportunity" | "own_project" | "own_client" | "own_opportunity_hint" | "own_project_hint" | "own_client_hint" | "own_pick_opportunity" | "own_pick_project" | "own_not_listed" | "own_firm" | "own_end_client" | "own_reference" | "own_reference_ph" | "own_closed") => string;

/**
 * "¿Para qué es?": la cotización siempre es de una oportunidad de Seguimiento
 * (trabajo nuevo), de un proyecto (algo más en una obra que ya tenemos) o,
 * sin ninguno, solo de un cliente (reparación, algo rápido). La firma, su
 * contacto y el cliente final salen siempre de Clientes, nunca texto libre:
 * con oportunidad o proyecto vienen de ahí; con solo cliente se eligen.
 */
export function OwnerPanel({
  quote,
  clients: baseClients,
  owners,
  tt,
  onChange,
}: {
  quote: Quote;
  clients: Client[];
  owners: QuoteOwnerOptions;
  tt: Tt;
  onChange: (patch: OwnerPatch) => void;
}) {
  const { tv } = useTv();
  // Una cotización todavía sin nadie arranca en "Oportunidad" (lo más común: trabajo nuevo).
  const [mode, setMode] = React.useState<QuoteOwnerKind>(() =>
    !quote.opportunityId && !quote.projectId && !quote.designerId && !quote.clientId ? "opportunity" : quoteOwnerKind(quote)
  );
  const [created, setCreated] = React.useState<Client[]>([]);
  const [newClient, setNewClient] = React.useState<{ name: string; kind: ClientKind } | null>(null);
  const clients = React.useMemo(() => [...baseClients, ...created.filter((c) => !baseClients.some((x) => x.id === c.id))], [baseClients, created]);

  const nameOf = (id: string | null) => (id ? (clients.find((c) => c.id === id)?.name ?? "") : "");
  const firm = clients.find((c) => c.id === quote.designerId);
  const firmContacts = firm?.contacts ?? [];
  const contactName = firmContacts.find((c) => c.id === quote.designerContactId)?.name;

  function pickMode(next: QuoteOwnerKind) {
    setMode(next);
    // Pasar a "solo cliente" conserva a las personas y suelta oportunidad y proyecto.
    if (next === "client" && (quote.opportunityId || quote.projectId)) {
      onChange(linkClients(quote, clients, quote.projectName));
    }
  }
  const setPeople = (ids: Partial<Pick<Quote, "designerId" | "designerContactId" | "clientId">>) => {
    const next = { designerId: quote.designerId, designerContactId: quote.designerContactId, clientId: quote.clientId, ...ids };
    if (mode === "project" && quote.projectId) {
      // En un proyecto la firma y el cliente vienen del proyecto; solo se elige el contacto.
      onChange({
        opportunityId: null,
        projectId: quote.projectId,
        designerId: quote.designerId,
        designerContactId: next.designerContactId,
        clientId: quote.clientId,
        clientName: quote.clientName,
        designerName: quote.designerName,
        projectName: quote.projectName,
      });
    } else onChange(linkClients(next, clients, quote.projectName));
  };

  const openOpps = owners.opportunities.filter((o) => o.stage !== "aprobada" && o.stage !== "perdida");
  const currentOpp = owners.opportunities.find((o) => o.id === quote.opportunityId);
  const oppOptions = currentOpp && !openOpps.includes(currentOpp) ? [currentOpp, ...openOpps] : openOpps;
  const people = (designerId: string | null, clientId: string | null) => [nameOf(designerId), nameOf(clientId)].filter(Boolean).join(" · ");

  const hint = mode === "opportunity" ? tt("own_opportunity_hint") : mode === "project" ? tt("own_project_hint") : tt("own_client_hint");

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{tt("own_title")}</h2>
        <SegmentedFilter
          value={mode}
          onChange={pickMode}
          options={[
            { value: "opportunity", label: tt("own_opportunity"), icon: Waypoints },
            { value: "project", label: tt("own_project"), icon: FolderKanban },
            { value: "client", label: tt("own_client"), icon: User },
          ]}
        />
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>

      {mode === "opportunity" && (
        <div className="flex flex-col gap-1.5">
          <SearchPicker
            placeholder={tt("own_pick_opportunity")}
            value={quote.opportunityId}
            options={oppOptions.map((o) => ({
              id: o.id,
              label: [o.title, o.location].filter(Boolean).join(" · ") || people(o.designerId, o.clientId),
              sub: people(o.designerId, o.clientId),
              badge: <StageBadge stage={o.stage as Stage} />,
            }))}
            onPick={(id) => {
              const o = owners.opportunities.find((x) => x.id === id);
              if (o) onChange(linkOpportunity(o, clients));
            }}
            empty={tv("no_results")}
          />
          <Link href={SEGUIMIENTO_PATH} className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {tt("own_not_listed")}
          </Link>
        </div>
      )}

      {mode === "project" && (
        <SearchPicker
          placeholder={tt("own_pick_project")}
          value={quote.projectId}
          options={owners.projects.map((p) => ({ id: p.id, label: p.name, sub: people(p.designerId, p.clientId) }))}
          onPick={(id) => {
            const p = owners.projects.find((x) => x.id === id);
            if (p) onChange(linkProject(p, clients));
          }}
          empty={tv("no_results")}
        />
      )}

      {/* Las personas: de la oportunidad (solo se ven), del proyecto (se elige el contacto) o elegidas. */}
      {mode === "opportunity" ? (
        quote.opportunityId && (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <Who label={tt("own_firm")} value={[nameOf(quote.designerId), contactName].filter(Boolean).join(" · ")} icon={Briefcase} />
            <Who label={tt("own_end_client")} value={nameOf(quote.clientId)} icon={User} />
          </dl>
        )
      ) : mode === "project" ? (
        quote.projectId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Who label={tt("own_firm")} value={nameOf(quote.designerId)} icon={Briefcase} />
              {firmContacts.length > 0 && <ContactSelect contacts={firmContacts} value={quote.designerContactId} onChange={(id) => setPeople({ designerContactId: id })} anyLabel={tv("contact_any")} />}
            </div>
            <Who label={tt("own_end_client")} value={nameOf(quote.clientId)} icon={User} />
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            {tt("own_firm")}
            <ClientPicker
              clients={clients}
              kind="arquitecto"
              value={quote.designerId}
              onChange={(id) => setPeople({ designerId: id, designerContactId: null })}
              onClear={() => setPeople({ designerId: null, designerContactId: null })}
              onCreate={async (name) => setNewClient({ name, kind: "arquitecto" })}
              placeholder={tv("pick_designer")}
            />
            {firmContacts.length > 0 && <ContactSelect contacts={firmContacts} value={quote.designerContactId} onChange={(id) => setPeople({ designerContactId: id })} anyLabel={tv("contact_any")} />}
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            {tt("own_end_client")}
            <ClientPicker
              clients={clients}
              kind="cliente"
              value={quote.clientId}
              onChange={(id) => setPeople({ clientId: id })}
              onClear={() => setPeople({ clientId: null })}
              onCreate={async (name) => setNewClient({ name, kind: "cliente" })}
              placeholder={tv("pick_client")}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
            {tt("own_reference")}
            <Input value={quote.projectName} placeholder={tt("own_reference_ph")} onChange={(e) => onChange({ ...linkClients(quote, clients, e.currentTarget.value) })} />
          </label>
        </div>
      )}

      <ClientDialog
        client={newClient}
        clients={clients}
        opportunities={[]}
        projects={[]}
        onClose={() => setNewClient(null)}
        onCreated={(c) => {
          setCreated((list) => [...list, c]);
          const all = [...clients, c];
          const ids = { designerId: quote.designerId, designerContactId: quote.designerContactId, clientId: quote.clientId };
          if (c.kind === "arquitecto") onChange(linkClients({ ...ids, designerId: c.id, designerContactId: null }, all, quote.projectName));
          else onChange(linkClients({ ...ids, clientId: c.id }, all, quote.projectName));
        }}
      />
    </section>
  );
}

function Who({ label, value, icon: Icon }: { label: string; value: string; icon: typeof User }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-foreground">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{value || "—"}</span>
      </dd>
    </div>
  );
}

function ContactSelect({
  contacts,
  value,
  onChange,
  anyLabel,
}: {
  contacts: Client["contacts"];
  value: string | null;
  onChange: (id: string | null) => void;
  anyLabel: string;
}) {
  return (
    <Select value={value ?? "__firm"} onValueChange={(v) => onChange(v === "__firm" ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__firm">{anyLabel}</SelectItem>
        {contacts.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.role ? `${c.name} · ${c.role}` : c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Elegir de una lista con búsqueda (oportunidades o proyectos). */
function SearchPicker({
  placeholder,
  value,
  options,
  onPick,
  empty,
}: {
  placeholder: string;
  value: string | null;
  options: { id: string; label: string; sub?: string; badge?: React.ReactNode }[];
  onPick: (id: string) => void;
  empty: string;
}) {
  const [open, setOpen] = React.useState(false);
  const picked = options.find((o) => o.id === value);
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-auto min-h-9 w-full justify-between py-1.5 font-normal">
          <span className={cn("flex min-w-0 flex-col items-start text-left", !picked && "text-muted-foreground")}>
            <span className="max-w-full truncate">{picked ? picked.label : placeholder}</span>
            {picked?.sub && <span className="max-w-full truncate text-xs text-muted-foreground">{picked.sub}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.label} ${o.sub ?? ""} ${o.id}`}
                  onSelect={() => {
                    onPick(o.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4 shrink-0", o.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.sub && <span className="truncate text-xs text-muted-foreground">{o.sub}</span>}
                  </span>
                  {o.badge}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
