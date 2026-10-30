-- Próximo seguimiento automático: al pasar a Enviada (a mano o porque la
-- cotización se marcó Enviada) queda para 7 días después; cada nota en la
-- bitácora mientras sigue Enviada lo corre otros 7 días; al cerrarla se borra.

create or replace function private.sales_opportunity_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'enviada' and new.sent_on is null then new.sent_on := private.panama_today(); end if;
    if new.stage = 'enviada' and (new.next_follow_up is null or new.next_follow_up <= private.panama_today()) then
      new.next_follow_up := private.panama_today() + 7;
    end if;
    if new.stage in ('aprobada', 'perdida') then
      new.closed_on := coalesce(new.closed_on, private.panama_today());
      new.next_follow_up := null;
    else
      new.closed_on := null;
    end if;
    if new.stage <> 'perdida' then new.lost_reason := null; new.lost_note := null; end if;
  end if;
  if tg_op = 'INSERT' and new.owner_id is null then new.owner_id := (select auth.uid()); end if;
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    new.owner_name := (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = new.owner_id);
  end if;
  return new;
end;
$$;

create or replace function private.sales_note_pushes_follow_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sales_opportunities
     set next_follow_up = private.panama_today() + 7
   where id = new.opportunity_id and stage = 'enviada';
  return null;
end;
$$;

drop trigger if exists sales_note_pushes_follow_up on public.sales_opportunity_notes;
create trigger sales_note_pushes_follow_up after insert on public.sales_opportunity_notes
  for each row execute function private.sales_note_pushes_follow_up();

-- Las que ya están Enviadas sin fecha: 7 días después de enviadas.
update public.sales_opportunities
   set next_follow_up = coalesce(sent_on, stage_changed_at::date) + 7
 where stage = 'enviada' and next_follow_up is null;
