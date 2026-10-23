-- Préstamos y descuentos de contratistas en cuotas, igual que a empleados.
--
-- public.contractor_loans guarda el préstamo, adelanto, herramienta, daño o
-- InDrive (monto, intereses, cuotas, quincena de inicio). Cada cuota es una
-- fila de contractor_ledger_entries enlazada por loan_id, que reduce el
-- saldo del contratista. La fecha de cada cuota es el inicio de su quincena
-- (el 1 o el 16; la primera, nunca antes de la fecha de la solicitud): una
-- cuota con fecha futura todavía no cuenta en el saldo de hoy.
--
-- Mismos permisos que el estado de cuenta: el módulo `contratistas`.
-- Sin sentencias que borren objetos. Idempotente.

create table if not exists public.contractor_loans (
  id                 uuid        primary key default gen_random_uuid(),
  contractor_id      uuid        not null references public.contractors (id) on delete cascade,
  category           text        not null check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'indrive')),
  principal_cents    integer     not null check (principal_cents > 0),
  interest_cents     integer     not null default 0 check (interest_cents >= 0),
  interest_mode      text        check (interest_mode is null or interest_mode in ('monthly_pct', 'total_pct', 'fixed')),
  interest_rate_pct  numeric     check (interest_rate_pct is null or interest_rate_pct >= 0),
  payment_method     text        not null default 'cuota_fija',
  num_installments   integer     not null check (num_installments >= 1),
  request_date       date        not null,
  start_period_year  integer     not null,
  start_period_month integer     not null check (start_period_month between 1 and 12),
  start_period_half  integer     not null check (start_period_half in (1, 2)),
  status             text        not null default 'active' check (status in ('active', 'cancelled')),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.contractor_loans is
  'Préstamos/adelantos/herramientas/daños/InDrive de contratistas en cuotas. Cada cuota es una fila de contractor_ledger_entries con loan_id.';

create index if not exists contractor_loans_contractor_idx on public.contractor_loans (contractor_id, request_date);

alter table public.contractor_ledger_entries
  add column if not exists loan_id uuid references public.contractor_loans (id) on delete cascade;
create index if not exists contractor_ledger_entries_loan_idx on public.contractor_ledger_entries (loan_id);

alter table public.contractor_loans enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contractor_loans'
                 and policyname = 'contractor_loans_module_all') then
    create policy "contractor_loans_module_all" on public.contractor_loans
      for all to authenticated
      using (private.has_module('contratistas'))
      with check (private.has_module('contratistas'));
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contractor_loans_touch_updated_at') then
    create trigger contractor_loans_touch_updated_at
      before update on public.contractor_loans
      for each row execute function private.touch_updated_at();
  end if;
end;
$$;

revoke all on public.contractor_loans from anon;
grant select, insert, update, delete on public.contractor_loans to authenticated;
