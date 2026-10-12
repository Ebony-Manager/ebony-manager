-- Fase 2 — Contratistas: ayudantes del contratista
--
-- Cada ebanista trabaja con uno o más ayudantes. Esta tabla guarda sus datos
-- personales y la cuenta bancaria (cédula, banco, tipo y número de cuenta,
-- teléfono) para poder pagarles. Un contratista puede tener varios ayudantes;
-- si se borra el contratista, se borran sus ayudantes (on delete cascade).
--
-- Aditivo: tabla nueva, no toca ninguna existente. Seguridad: igual que el
-- resto del módulo — RLS ON y una sola policy admin-only (`private.is_admin()`).

create table public.contractor_helpers (
  id                   uuid        primary key default gen_random_uuid(),
  contractor_id        uuid        not null references public.contractors (id) on delete cascade,
  name                 text        not null,
  id_document          text,
  phone                text,
  bank_name            text,
  bank_account_type    text        check (bank_account_type is null or bank_account_type in ('ahorro', 'corriente')),
  bank_account_number  text,
  notes                text,
  sort_order           integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.contractor_helpers is
  'Ayudantes de un contratista, con sus datos personales y cuenta bancaria para pagarles.';

create index idx_contractor_helpers_contractor
  on public.contractor_helpers (contractor_id);

alter table public.contractor_helpers enable row level security;

create policy "contractor_helpers_admin_all"
  on public.contractor_helpers
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create trigger contractor_helpers_touch_updated_at
  before update on public.contractor_helpers
  for each row execute function private.touch_updated_at();

revoke all on public.contractor_helpers from anon;
grant select, insert, update, delete on public.contractor_helpers to authenticated;
