-- Usuarios ↔ Personal: cada usuario de la app puede apuntar a su ficha en Personal (payroll_employees).
-- Una persona de Personal solo puede ser un usuario. Si se borra la ficha, el usuario sigue (sin enlace).
alter table public.allowed_emails
  add column if not exists employee_id uuid references public.payroll_employees(id) on delete set null;

create unique index if not exists allowed_emails_employee_uidx
  on public.allowed_emails (employee_id) where employee_id is not null;

comment on column public.allowed_emails.employee_id is 'Su ficha en Personal (payroll_employees), si la tiene.';

-- Los que ya coinciden por correo se enlazan solos.
update public.allowed_emails a
   set employee_id = e.id
  from public.payroll_employees e
 where a.employee_id is null
   and e.email is not null
   and lower(btrim(e.email)) = lower(btrim(a.email));
