-- Alegra (sistema contable): al aprobar una cotización se crea en Alegra una
-- factura de venta en BORRADOR por la cotización completa, a nombre del
-- cliente amarrado a la cotización (sin factura electrónica: lo fiscal se
-- hace en otra herramienta). Alguien la revisa en Alegra.
--
-- quote_alegra: el enlace de cada cotización con su factura de Alegra y cómo
-- va (para "Ver en Alegra" o "Reintentar"). Va aparte de `quotes` para no
-- tocar su updated_at (el guardado de la cotización lo usa para detectar
-- cambios de otra persona). Una fila por cotización: nunca dos facturas.
-- clients.alegra_contact_id: el contacto de Alegra que le corresponde (se
-- busca por nombre o se crea la primera vez).
-- El producto/servicio y el impuesto de Alegra que se usan van en
-- app_settings ('alegra'); los elige el admin en Settings → Conexiones.

create table if not exists public.quote_alegra (
  quote_id        uuid primary key references public.quotes (id) on delete cascade,
  status          text not null check (status in ('creando', 'creada', 'error')),
  invoice_id      text,
  invoice_number  text,
  error           text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.quote_alegra enable row level security;
drop policy if exists "quote_alegra_cotizacion" on public.quote_alegra;
create policy "quote_alegra_cotizacion" on public.quote_alegra for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));

alter table public.clients
  add column if not exists alegra_contact_id text;
