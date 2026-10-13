-- Fase 2 — Planilla: herramientas/daños a cuotas, cuota variable e InDrive
--
-- 1) Los préstamos (payroll_loans) pasan a poder ser también 'herramienta' y
--    'dano': la compra de una herramienta (o el cobro de un daño) se registra
--    una vez y se paga en 2-3 cuotas, con el mismo calendario de cuotas que un
--    préstamo. payment_method ya es texto abierto: 'cuota_variable' no
--    necesita cambio de esquema.
-- 2) El ledger acepta la categoría 'indrive'.
-- 3) Tabla nueva payroll_indrive_rides: cada viaje de InDrive (transporte del
--    empleado) con su monto y si se le cobra o no. Si se cobra, el viaje queda
--    enlazado a las dos filas de ledger (deuda + descuento en la quincena).
--
-- Aditivo salvo por reemplazar dos CHECK de categoría por versiones más
-- amplias (todo lo que ya existe sigue siendo válido).

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.payroll_loans'::regclass, 'public.payroll_ledger_entries'::regclass)
      and pg_get_constraintdef(oid) like '%category%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.payroll_loans
  add constraint payroll_loans_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano'));

alter table public.payroll_ledger_entries
  add constraint payroll_ledger_entries_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'seguro_social', 'carnet', 'otro', 'indrive'));

create table public.payroll_indrive_rides (
  id                uuid        primary key default gen_random_uuid(),
  employee_id       uuid        not null references public.payroll_employees (id) on delete cascade,
  ride_date         date        not null,
  amount_cents      integer     not null check (amount_cents > 0),
  -- ¿Se le cobra este viaje al empleado? Siempre queda en el historial.
  charge            boolean     not null default false,
  -- Filas de ledger creadas cuando charge = true (deuda informativa y el
  -- descuento en la quincena del viaje). NULL cuando no se cobra.
  debt_ledger_id    uuid        references public.payroll_ledger_entries (id) on delete set null,
  payment_ledger_id uuid        references public.payroll_ledger_entries (id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.payroll_indrive_rides is
  'Viajes de InDrive (transporte) de cada empleado. charge indica si se le cobra; si se cobra, se enlazan las filas de ledger que lo descuentan.';

create index idx_payroll_indrive_employee_date
  on public.payroll_indrive_rides (employee_id, ride_date);

alter table public.payroll_indrive_rides enable row level security;

create policy "payroll_indrive_rides_admin_all"
  on public.payroll_indrive_rides
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create trigger payroll_indrive_rides_touch_updated_at
  before update on public.payroll_indrive_rides
  for each row execute function private.touch_updated_at();

revoke all on public.payroll_indrive_rides from anon;
grant select, insert, update, delete on public.payroll_indrive_rides to authenticated;
