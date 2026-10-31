-- Programación por áreas: lo principal es ponerle DÍA a los detalles (un área
-- completa de una obra a un día, en un orden); quién lo atiende se asigna
-- después. Por eso la persona pasa a ser opcional y el orden es del día (de
-- todo lo de ese día), no de cada persona.

alter table public.inspection_schedules alter column person_kind drop not null;
alter table public.inspection_schedules alter column person_id drop not null;
alter table public.inspection_schedules alter column person_name drop not null;
alter table public.inspection_schedules drop constraint if exists inspection_schedules_person_chk;
alter table public.inspection_schedules add constraint inspection_schedules_person_chk
  check ((person_id is null and person_kind is null and person_name is null)
      or (person_id is not null and person_kind is not null and person_name is not null));
create index if not exists inspection_schedules_date_idx on public.inspection_schedules (scheduled_on) where outcome = 'programado';

-- Pone detalles en un día, en el orden dado: al final del día o antes de otra
-- programación (p_before). Si un detalle ya estaba ese mismo día, solo cambia
-- de lugar; si estaba en otro día, esa queda "reprogramado" y nace otra (con
-- la misma persona y nota, salvo que se indique persona). Sin persona = sin asignar.
create or replace function public.plan_inspection_items(
  p_item_ids uuid[], p_date date, p_before uuid default null,
  p_person_kind text default null, p_person_id uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_by text;
  v_start integer;
  v_n integer := coalesce(array_length(p_item_ids, 1), 0);
  v_i integer := 0;
  v_item uuid;
  v_prev public.inspection_schedules%rowtype;
begin
  if not private.has_module('inspecciones') then raise exception 'SIN_PERMISO'; end if;
  if v_n = 0 then return 0; end if;
  if p_person_id is not null then
    if p_person_kind = 'contratista' then
      select name into v_name from public.contractors where id = p_person_id;
    elsif p_person_kind = 'empleado' then
      select name into v_name from public.payroll_employees where id = p_person_id;
    end if;
    if v_name is null then raise exception 'PERSONA_NO_EXISTE'; end if;
  end if;
  select coalesce(nullif(full_name, ''), email) into v_by from public.profiles where id = auth.uid();

  -- Dónde empiezan: antes de p_before (si es de ese día y está abierta) o al final.
  if p_before is not null then
    select sort_order into v_start from public.inspection_schedules
     where id = p_before and scheduled_on = p_date and outcome = 'programado' and not (item_id = any (p_item_ids));
  end if;
  if v_start is null then
    select coalesce(max(sort_order), 0) + 1 into v_start from public.inspection_schedules
     where scheduled_on = p_date and outcome in ('programado', 'hecho') and not (item_id = any (p_item_ids));
  else
    -- Corre lo demás para hacer espacio.
    update public.inspection_schedules set sort_order = sort_order + v_n
     where scheduled_on = p_date and outcome in ('programado', 'hecho') and sort_order >= v_start and not (item_id = any (p_item_ids));
  end if;

  foreach v_item in array p_item_ids loop
    select * into v_prev from public.inspection_schedules where item_id = v_item and outcome = 'programado';
    if found and v_prev.scheduled_on = p_date then
      update public.inspection_schedules
         set sort_order = v_start + v_i,
             person_kind = coalesce(p_person_kind, person_kind),
             person_id = coalesce(p_person_id, person_id),
             person_name = coalesce(v_name, person_name)
       where id = v_prev.id;
    else
      if found then
        update public.inspection_schedules set outcome = 'reprogramado', closed_at = now() where id = v_prev.id;
      end if;
      insert into public.inspection_schedules (item_id, person_kind, person_id, person_name, scheduled_on, sort_order, note, created_by_name)
      values (
        v_item,
        case when p_person_id is not null then p_person_kind else v_prev.person_kind end,
        coalesce(p_person_id, v_prev.person_id),
        coalesce(v_name, v_prev.person_name),
        p_date, v_start + v_i, v_prev.note, v_by
      );
    end if;
    v_i := v_i + 1;
  end loop;

  -- Renumera el día 1..n (sin huecos ni repetidos).
  update public.inspection_schedules s set sort_order = o.rn
    from (select id, row_number() over (order by sort_order, created_at) as rn
            from public.inspection_schedules
           where scheduled_on = p_date and outcome in ('programado', 'hecho')) o
   where s.id = o.id and s.sort_order <> o.rn;
  return v_n;
end;
$$;
revoke all on function public.plan_inspection_items(uuid[], date, uuid, text, uuid) from public, anon;
grant execute on function public.plan_inspection_items(uuid[], date, uuid, text, uuid) to authenticated;

-- Asigna (o quita, con persona null) quién atiende unas programaciones abiertas.
create or replace function public.assign_inspection_schedules(
  p_ids uuid[], p_person_kind text default null, p_person_id uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_count integer;
begin
  if not private.has_module('inspecciones') then raise exception 'SIN_PERMISO'; end if;
  if p_person_id is not null then
    if p_person_kind = 'contratista' then
      select name into v_name from public.contractors where id = p_person_id;
    elsif p_person_kind = 'empleado' then
      select name into v_name from public.payroll_employees where id = p_person_id;
    end if;
    if v_name is null then raise exception 'PERSONA_NO_EXISTE'; end if;
  end if;
  update public.inspection_schedules
     set person_kind = case when p_person_id is null then null else p_person_kind end,
         person_id = p_person_id,
         person_name = v_name
   where id = any (p_ids) and outcome = 'programado';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.assign_inspection_schedules(uuid[], text, uuid) from public, anon;
grant execute on function public.assign_inspection_schedules(uuid[], text, uuid) to authenticated;

-- El orden pasa a ser del día: lo ya programado se renumera 1..n por día,
-- conservando la secuencia de cada persona.
update public.inspection_schedules s set sort_order = o.rn
  from (select id, row_number() over (partition by scheduled_on order by person_name nulls last, sort_order, created_at) rn
          from public.inspection_schedules where outcome in ('programado', 'hecho')) o
 where s.id = o.id and s.sort_order <> o.rn;
