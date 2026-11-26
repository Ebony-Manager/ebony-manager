-- Diseño: bloques de trabajo. Los ítems que se avanzan juntos (un mismo plano, aunque sean de áreas distintas) quedan
-- con el mismo `block_id` y el tablero los muestra como una sola tarjeta. En «Por medir» el bloque es el área.
-- Avanzar solo una parte de un bloque los separa (los que avanzan forman uno nuevo).
alter table public.project_items add column if not exists block_id uuid;
create index if not exists project_items_block_idx on public.project_items (block_id);
comment on column public.project_items.block_id is 'Bloque de trabajo: ítems que se avanzaron juntos (null = solo, o por área en Por medir).';

-- Los que ya están en En diseño o Aprobado: un bloque por proyecto, etapa y área.
with g as (
  select project_id, stage, btrim(area) as area, gen_random_uuid() as block
    from public.project_items
   where stage in ('en_diseno', 'aprobado') and block_id is null
   group by project_id, stage, btrim(area)
)
update public.project_items i set block_id = g.block
  from g where i.project_id = g.project_id and i.stage = g.stage and btrim(i.area) = g.area and i.block_id is null;
