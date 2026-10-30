-- Contactos de un cliente: una firma de arquitectos o diseño suele tener
-- una, dos o tres personas con quienes se habla. El cliente es la firma; cada
-- oportunidad puede decir con cuál de sus contactos se lleva.

create table if not exists public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null check (btrim(name) <> ''),
  role        text,
  phone       text,
  email       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists client_contacts_client_idx on public.client_contacts (client_id, sort_order);

alter table public.client_contacts enable row level security;
drop policy if exists "client_contacts_cotizacion_all" on public.client_contacts;
create policy "client_contacts_cotizacion_all" on public.client_contacts for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));
drop policy if exists "client_contacts_proyectos_read" on public.client_contacts;
create policy "client_contacts_proyectos_read" on public.client_contacts for select to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas'));
grant select, insert, update, delete on public.client_contacts to authenticated;

alter table public.sales_opportunities
  add column if not exists designer_contact_id uuid references public.client_contacts (id) on delete set null;
