-- Usuarios ↔ Contratistas: un usuario de la app puede apuntar a su ficha de contratista (p. ej. un pintor,
-- para que vea en Taller los trabajos que tiene asignados). Es una cosa u otra: Personal o contratista.
alter table public.allowed_emails
  add column if not exists contractor_id uuid references public.contractors(id) on delete set null;

create unique index if not exists allowed_emails_contractor_uidx
  on public.allowed_emails (contractor_id) where contractor_id is not null;

alter table public.allowed_emails drop constraint if exists allowed_emails_one_link;
alter table public.allowed_emails add constraint allowed_emails_one_link
  check (employee_id is null or contractor_id is null);

comment on column public.allowed_emails.contractor_id is 'Su ficha de contratista, si la tiene (en vez de Personal).';

-- El contratista del usuario que está conectado (o null).
create or replace function private.my_contractor_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select a.contractor_id
    from public.allowed_emails a
    join public.profiles p on lower(p.email) = lower(a.email)
   where p.id = auth.uid()
   limit 1
$$;
revoke all on function private.my_contractor_id() from public, anon;
grant execute on function private.my_contractor_id() to authenticated;

create or replace function public.my_contractor_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select private.my_contractor_id() $$;
revoke all on function public.my_contractor_id() from public, anon;
grant execute on function public.my_contractor_id() to authenticated;
