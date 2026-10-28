-- Catálogo, destinatarios y preferencias push administradas por usuario.
create table if not exists public.notification_types (
  key text primary key,
  module text not null,
  title text not null,
  description text not null,
  default_push boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.notification_types (key, module, title, description, default_push, sort_order) values
  ('personal_new_intake', 'documentos', 'Nuevo registro de personal', 'Llegó un empleado o contratista para oficializar.', true, 10),
  ('personal_status', 'documentos', 'Cambio de estado del personal', 'Un empleado o contratista fue activado o inactivado.', false, 20),
  ('attendance_adjustment', 'asistencia', 'Ajuste manual de asistencia', 'Se corrigió o deshizo manualmente un día de asistencia.', true, 30),
  ('payroll_loan', 'planilla', 'Nuevo préstamo o adelanto', 'Se registró un préstamo o adelanto de planilla.', true, 40),
  ('payroll_deduction', 'planilla', 'Nuevo descuento', 'Se registró un descuento en el estado de cuenta de un empleado.', true, 50),
  ('warehouse_low_stock', 'almacen', 'Producto bajo mínimo', 'Un producto llegó o bajó de su mínimo.', false, 60),
  ('warehouse_out_stock', 'almacen', 'Producto agotado', 'Un producto quedó sin existencia.', true, 70),
  ('warehouse_adjustment', 'almacen', 'Ajuste de inventario', 'Se realizó un ajuste manual de inventario.', false, 80),
  ('purchasing_request', 'almacen_compras', 'Nueva solicitud de compra', 'Se creó una solicitud que Compras debe atender.', true, 90),
  ('purchasing_no_supplier', 'almacen_compras', 'Solicitud sin proveedor', 'Una solicitud nueva todavía no tiene proveedor.', true, 100),
  ('purchasing_overdue', 'almacen_compras', 'Pedido atrasado', 'Un pedido sigue pendiente después del plazo esperado.', true, 110),
  ('purchasing_received', 'almacen_compras', 'Pedido recibido', 'Se completó la recepción de un pedido.', false, 120),
  ('inspection_created', 'inspecciones', 'Nueva inspección', 'Se registró una visita de inspección.', false, 130),
  ('inspection_status', 'inspecciones', 'Cambio en una observación', 'Una observación fue resuelta o reabierta.', false, 140)
on conflict (key) do update set module = excluded.module, title = excluded.title,
  description = excluded.description, default_push = excluded.default_push, sort_order = excluded.sort_order;

alter table public.notification_types enable row level security;
create policy "notification_types_authenticated_read" on public.notification_types for select to authenticated using (true);
grant select on public.notification_types to authenticated;

create table if not exists public.user_notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type_key text not null references public.notification_types (key) on delete cascade,
  push_enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (user_id, type_key)
);
alter table public.user_notification_preferences enable row level security;
create policy "notification_preferences_own_read" on public.user_notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notification_preferences_admin_all" on public.user_notification_preferences for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.user_notification_preferences to authenticated;
create policy "push_subscriptions_admin_read" on public.push_subscriptions for select to authenticated using (private.is_admin());

alter table public.app_notifications add column if not exists type_key text references public.notification_types (key);
alter table public.app_notifications add column if not exists module text;
alter table public.app_notifications add column if not exists dedupe_key text;
create unique index if not exists app_notifications_dedupe_idx on public.app_notifications (dedupe_key) where dedupe_key is not null;

create table if not exists public.app_notification_recipients (
  notification_id uuid not null references public.app_notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz,
  push_sent_at timestamptz,
  primary key (notification_id, user_id)
);
create index if not exists app_notification_recipients_user_idx on public.app_notification_recipients (user_id, read_at);
alter table public.app_notification_recipients enable row level security;
create policy "notification_recipients_own_read" on public.app_notification_recipients for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notification_recipients_own_update" on public.app_notification_recipients for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, update on public.app_notification_recipients to authenticated;

-- Los avisos anteriores eran exclusivamente administrativos.
insert into public.app_notification_recipients (notification_id, user_id, read_at)
select n.id, p.id, case when n.seen_at is null then null else n.seen_at end
from public.app_notifications n cross join public.profiles p where p.role = 'admin'
on conflict do nothing;

create or replace function private.fanout_app_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_module text;
begin
  if new.type_key is null and new.kind = 'asistencia_ajuste' then new.type_key := 'attendance_adjustment'; end if;
  select t.module into v_module from public.notification_types t where t.key = new.type_key and t.active;
  new.module := coalesce(new.module, v_module);
  return new;
end; $$;
create or replace function private.fanout_app_notification_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_notification_recipients (notification_id, user_id)
  select new.id, p.id from public.profiles p
  where p.role = 'admin' or new.module = any(coalesce(p.modules, '{}'::text[]))
  on conflict do nothing;
  return null;
end; $$;
drop trigger if exists app_notifications_set_type on public.app_notifications;
create trigger app_notifications_set_type before insert on public.app_notifications
  for each row execute function private.fanout_app_notification();
drop trigger if exists app_notifications_fanout on public.app_notifications;
create trigger app_notifications_fanout after insert on public.app_notifications
  for each row execute function private.fanout_app_notification_after();

drop policy if exists "app_notifications_admin_read" on public.app_notifications;
drop policy if exists "app_notifications_admin_update" on public.app_notifications;
create policy "app_notifications_recipient_read" on public.app_notifications for select to authenticated
  using (exists (select 1 from public.app_notification_recipients r where r.notification_id = id and r.user_id = (select auth.uid())));

-- Eventos actuales --------------------------------------------------------
create or replace function private.notify_staff_intake() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending' then
    insert into public.app_notifications(kind,type_key,title,body,href)
    values ('personal_new_intake','personal_new_intake','Nuevo registro de personal',
      coalesce(nullif(trim(concat_ws(' ',new.first_name,new.last_name)),''), new.email, 'Registro pendiente'), '/personal/staff');
  end if; return null;
end; $$;
drop trigger if exists staff_intake_notify on public.staff_intake;
create trigger staff_intake_notify after insert on public.staff_intake for each row execute function private.notify_staff_intake();

create or replace function private.notify_person_status() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_active boolean;
begin
  if new.status = old.status then return null; end if;
  v_name := new.name; v_active := new.status = 'ACTIVE';
  insert into public.app_notifications(kind,type_key,title,body,href)
  values ('personal_status','personal_status','Cambio de estado del personal',
    concat(v_name,case when v_active then ' · Activado' else ' · Inactivado' end),'/personal/staff');
  return null;
end; $$;
drop trigger if exists payroll_employees_status_notify on public.payroll_employees;
create trigger payroll_employees_status_notify after update of status on public.payroll_employees for each row execute function private.notify_person_status();
drop trigger if exists contractors_status_notify on public.contractors;
create trigger contractors_status_notify after update of status on public.contractors for each row execute function private.notify_person_status();

create or replace function private.notify_payroll_loan() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select e.name into v_name from public.payroll_employees e where e.id = new.employee_id;
  insert into public.app_notifications(kind,type_key,title,body,href,actor_id)
  values ('payroll_loan','payroll_loan','Nuevo préstamo o adelanto',
    concat_ws(' · ',v_name,initcap(new.category),to_char(new.principal_cents / 100.0,'FM$999G999G990D00')), '/personal/pagos', (select auth.uid()));
  return null;
end; $$;
drop trigger if exists payroll_loans_notify on public.payroll_loans;
create trigger payroll_loans_notify after insert on public.payroll_loans for each row execute function private.notify_payroll_loan();

create or replace function private.notify_payroll_deduction() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.direction <> 'reduce' or new.loan_id is not null or new.category in ('pago','ajuste') then return null; end if;
  select e.name into v_name from public.payroll_employees e where e.id = new.employee_id;
  insert into public.app_notifications(kind,type_key,title,body,href,actor_id)
  values ('payroll_deduction','payroll_deduction','Nuevo descuento',
    concat_ws(' · ',v_name,initcap(replace(new.category,'_',' ')),to_char(new.amount_cents / 100.0,'FM$999G999G990D00')), '/personal/pagos', (select auth.uid()));
  return null;
end; $$;
drop trigger if exists payroll_ledger_notify on public.payroll_ledger_entries;
create trigger payroll_ledger_notify after insert on public.payroll_ledger_entries for each row execute function private.notify_payroll_deduction();

create or replace function private.notify_inventory_adjustment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_notifications(kind,type_key,title,body,href,actor_id,actor_name)
  values ('warehouse_adjustment','warehouse_adjustment','Ajuste de inventario',
    concat_ws(' · ',initcap(new.reason),new.notes),'/almacen/movimientos',new.created_by,new.created_by_name);
  return null;
end; $$;
drop trigger if exists inventory_adjustments_notify on public.inventory_adjustments;
create trigger inventory_adjustments_notify after insert on public.inventory_adjustments for each row execute function private.notify_inventory_adjustment();

create or replace function private.notify_stock_threshold() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_type text;
begin
  if new.stock_qty >= old.stock_qty then return null; end if;
  if new.stock_qty <= 0 and old.stock_qty > 0 then v_type := 'warehouse_out_stock';
  elsif new.min_qty is not null and new.stock_qty <= new.min_qty and old.stock_qty > new.min_qty then v_type := 'warehouse_low_stock';
  else return null; end if;
  select concat_ws(' · ',i.name,nullif(new.label,'')) into v_name from public.inventory_items i where i.id = new.item_id;
  insert into public.app_notifications(kind,type_key,title,body,href,dedupe_key)
  values (v_type,v_type,case when v_type='warehouse_out_stock' then 'Producto agotado' else 'Producto bajo mínimo' end,
    concat(v_name,' · Hay ',new.stock_qty),'/almacen',concat(v_type,':',new.id,':',current_date));
  return null;
end; $$;
drop trigger if exists inventory_stock_notify on public.inventory_variants;
create trigger inventory_stock_notify after update of stock_qty on public.inventory_variants for each row execute function private.notify_stock_threshold();

create or replace function private.notify_purchase_request() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_notifications(kind,type_key,title,body,href,actor_id,actor_name)
  values ('purchasing_request','purchasing_request','Nueva solicitud de compra',concat(new.description,' · ',new.qty,' ',coalesce(new.unit,'')),
    '/almacen/compras',new.created_by,new.created_by_name);
  if new.supplier_id is null then
    insert into public.app_notifications(kind,type_key,title,body,href,dedupe_key)
    values ('purchasing_no_supplier','purchasing_no_supplier','Solicitud sin proveedor',new.description,'/almacen/compras','no_supplier:'||new.id::text);
  end if; return null;
end; $$;
drop trigger if exists purchase_requests_notify on public.purchase_requests;
create trigger purchase_requests_notify after insert on public.purchase_requests for each row execute function private.notify_purchase_request();

create or replace function private.notify_purchase_received() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_supplier text;
begin
  if new.status <> 'recibido' or old.status = 'recibido' then return null; end if;
  select s.name into v_supplier from public.suppliers s where s.id = new.supplier_id;
  insert into public.app_notifications(kind,type_key,title,body,href,dedupe_key)
  values ('purchasing_received','purchasing_received','Pedido recibido',v_supplier,'/almacen/compras','received:'||new.id::text);
  return null;
end; $$;
drop trigger if exists purchase_orders_received_notify on public.purchase_orders;
create trigger purchase_orders_received_notify after update of status on public.purchase_orders for each row execute function private.notify_purchase_received();

create or replace function private.notify_inspection_created() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project text;
begin
  select p.name into v_project from public.projects p where p.id = new.project_id;
  insert into public.app_notifications(kind,type_key,title,body,href,actor_name)
  values ('inspection_created','inspection_created','Nueva inspección',concat_ws(' · ',v_project,to_char(new.visited_on,'DD/MM/YYYY')),
    '/inspecciones/'||new.project_id::text,new.created_by_name);
  return null;
end; $$;
drop trigger if exists inspections_notify on public.inspections;
create trigger inspections_notify after insert on public.inspections for each row execute function private.notify_inspection_created();

create or replace function private.notify_inspection_status() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project uuid; v_project_name text;
begin
  if new.status = old.status then return null; end if;
  select i.project_id,p.name into v_project,v_project_name from public.inspections i join public.projects p on p.id=i.project_id where i.id=new.inspection_id;
  insert into public.app_notifications(kind,type_key,title,body,href,actor_name)
  values ('inspection_status','inspection_status',case when new.status='resuelto' then 'Observación resuelta' else 'Observación reabierta' end,
    concat_ws(' · ',v_project_name,new.area,new.comment),'/inspecciones/'||v_project::text,new.resolved_by_name);
  return null;
end; $$;
drop trigger if exists inspection_items_status_notify on public.inspection_items;
create trigger inspection_items_status_notify after update of status on public.inspection_items for each row execute function private.notify_inspection_status();
