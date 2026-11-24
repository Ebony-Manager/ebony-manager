-- Diseño: se quita la etapa «Con el cliente». El ida y vuelta con el cliente va por WhatsApp; las etapas quedan
-- Por medir → En diseño → Aprobado (→ En producción). En su lugar, una casilla opcional «Esperando al cliente»:
-- mientras está marcada el ítem no se marca atrasado. Se apaga sola al cambiar de etapa.

alter table public.project_items add column if not exists waiting_client boolean not null default false;
comment on column public.project_items.waiting_client is 'La diseñadora espera respuesta del cliente (no cuenta como atraso).';

update public.project_items set stage = 'en_diseno', waiting_client = true where stage = 'con_cliente';

alter table public.project_items drop constraint if exists project_items_stage_check;
alter table public.project_items add constraint project_items_stage_check
  check (stage in ('por_medir', 'en_diseno', 'aprobado', 'en_produccion'));

create or replace function private.project_item_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_since := now();
    new.waiting_client := false;
  end if;
  return new;
end; $$;
