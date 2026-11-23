-- Diseño: el historial de un ítem con el nombre de quien hizo cada cosa (sin abrir la tabla de usuarios).
create or replace function public.item_events(p_item uuid)
returns table (id bigint, kind text, from_stage text, to_stage text, detail text, actor_name text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.kind, e.from_stage, e.to_stage, e.detail,
         coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)), e.created_at
    from public.project_item_events e
    left join public.profiles p on p.id = e.actor_id
   where e.item_id = p_item
     and (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
   order by e.created_at desc
$$;
revoke all on function public.item_events(uuid) from public, anon;
grant execute on function public.item_events(uuid) to authenticated;
