-- Bandeja de "Solicitudes de dinero" (Planilla → Préstamos), alimentada por
-- el workflow de JotForm "Solicitud Dinero".
--
-- El webhook va en la rama APROBADA del workflow: lo que llega acá ya está
-- aprobado. En la app se registra como préstamo/adelanto en la planilla del
-- empleado (con sus cuotas) o como movimiento en el estado de cuenta del
-- contratista, o se descarta.
--
-- Igual que staff_intake: sin service_role, entra solo por
-- public.ingest_money_request, que valida el token del webhook contra su
-- hash en private.integration_tokens (el mismo token 'jotform').
--
-- Sin sentencias que borren objetos. Idempotente.

create table if not exists public.money_requests (
  id              uuid primary key default gen_random_uuid(),
  source          text not null default 'jotform',
  form_id         text,
  submission_id   text not null,
  submitted_at    timestamptz,
  first_name      text,
  last_name       text,
  email           text,
  request_type    text check (request_type is null or request_type in ('adelanto', 'prestamo')),
  amount_cents    integer check (amount_cents is null or amount_cents >= 0),
  -- Lo que se descuenta según el formulario (préstamo = monto + 20%).
  deduct_cents    integer check (deduct_cents is null or deduct_cents >= 0),
  raw             jsonb not null default '{}'::jsonb,
  status          text not null default 'pending' check (status in ('pending', 'registered', 'dismissed')),
  person_kind     text check (person_kind is null or person_kind in ('employee', 'contractor')),
  person_id       uuid,
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (source, submission_id)
);

comment on table public.money_requests is
  'Solicitudes de adelanto/préstamo aprobadas en el workflow de JotForm, por registrar en Planilla o Contratistas. Entran solo por public.ingest_money_request.';
comment on column public.money_requests.status is
  'pending = por registrar; registered = ya se registró en la planilla o el estado de cuenta; dismissed = descartada.';

create index if not exists money_requests_pending_idx on public.money_requests (created_at desc) where status = 'pending';

alter table public.money_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'money_requests'
                 and policyname = 'money_requests_select_staff_modules') then
    create policy "money_requests_select_staff_modules" on public.money_requests
      for select to authenticated
      using (private.has_module('planilla') or private.has_module('contratistas'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'money_requests'
                 and policyname = 'money_requests_update_staff_modules') then
    create policy "money_requests_update_staff_modules" on public.money_requests
      for update to authenticated
      using (private.has_module('planilla') or private.has_module('contratistas'))
      with check (private.has_module('planilla') or private.has_module('contratistas'));
  end if;
end;
$$;

create or replace function public.ingest_money_request(p_token text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'jotform'
       and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_data ->> 'submission_id', '') = '' then
    raise exception 'Falta submission_id';
  end if;

  insert into public.money_requests (
    source, form_id, submission_id, submitted_at, first_name, last_name, email,
    request_type, amount_cents, deduct_cents, raw
  ) values (
    'jotform',
    p_data ->> 'form_id',
    p_data ->> 'submission_id',
    nullif(p_data ->> 'submitted_at', '')::timestamptz,
    p_data ->> 'first_name',
    p_data ->> 'last_name',
    p_data ->> 'email',
    p_data ->> 'request_type',
    nullif(p_data ->> 'amount_cents', '')::integer,
    nullif(p_data ->> 'deduct_cents', '')::integer,
    coalesce(p_data -> 'raw', '{}'::jsonb)
  )
  -- Si JotForm avisa dos veces la misma solicitud, no se duplica.
  on conflict (source, submission_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ingest_money_request(text, jsonb) from public;
grant execute on function public.ingest_money_request(text, jsonb) to anon, authenticated;
