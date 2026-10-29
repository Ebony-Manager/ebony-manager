-- Almacén → pintor: todo lo que sale del almacén a un contratista pintor se le
-- descuenta completo en su estado de cuenta, a costo + 10%. Un cargo
-- "Material" por salida, con el detalle de lo que se llevó, enganchado a la
-- salida (inventory_issue_id). Lo que no tenga costo cargado no se cobra y
-- queda anotado en la nota del cargo para revisarlo.

alter table public.contractor_ledger_entries
  add column if not exists inventory_issue_id uuid references public.inventory_issues (id) on delete cascade;
create index if not exists contractor_ledger_issue_idx on public.contractor_ledger_entries (inventory_issue_id);

create or replace function public.register_inventory_issue(
  p_issued_on date,
  p_employee_id uuid,
  p_contractor_id uuid,
  p_project_id uuid,
  p_internal_use text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue uuid;
  v_line jsonb;
  v_qty numeric;
  v_dec boolean;
  v_date date := coalesce(p_issued_on, private.panama_today());
  v_name text;
  v_cost numeric;
  v_total numeric := 0;
  v_detail text[] := '{}';
  v_missing text[] := '{}';
begin
  if not private.has_module('almacen') then raise exception 'Sin permiso de Almacén.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'La salida no tiene productos.'; end if;

  insert into public.inventory_issues (issued_on, recipient_employee_id, recipient_contractor_id, project_id, internal_use, notes)
  values (v_date, p_employee_id, p_contractor_id, p_project_id, nullif(p_internal_use, ''), nullif(btrim(p_notes), ''))
  returning id into v_issue;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Cantidad inválida.'; end if;
    select i.allows_decimals, btrim(i.name || ' ' || coalesce(v.label, '')), c.unit_cost_cents
      into v_dec, v_name, v_cost
      from public.inventory_variants v
      join public.inventory_items i on i.id = v.item_id
      left join public.inventory_costs c on c.variant_id = v.id
     where v.id = (v_line ->> 'variant_id')::uuid;
    if not found then raise exception 'Producto no encontrado.'; end if;
    if not v_dec and v_qty <> trunc(v_qty) then raise exception 'Ese producto no se entrega en fracciones.'; end if;
    insert into public.inventory_movements (variant_id, kind, qty, moved_on, issue_id)
    values ((v_line ->> 'variant_id')::uuid, 'salida', -v_qty, v_date, v_issue);

    if v_cost is null then
      v_missing := v_missing || v_name;
    else
      v_total := v_total + v_qty * v_cost;
      v_detail := v_detail || (v_name || ' ×' || trim_scale(v_qty)::text);
    end if;
  end loop;

  -- Pintor: se le descuenta a costo + 10%.
  if p_contractor_id is not null
     and exists (select 1 from public.contractors where id = p_contractor_id and contractor_type = 'pintor')
     and (v_total > 0 or cardinality(v_missing) > 0) then
    insert into public.contractor_ledger_entries
      (contractor_id, project_id, entry_date, category, direction, amount_cents, description, notes, inventory_issue_id)
    values (
      p_contractor_id, p_project_id, v_date, 'material', 'reduce',
      round(v_total * 1.10)::integer,
      left('Material de almacén (costo + 10%): ' || coalesce(nullif(array_to_string(v_detail, ', '), ''), '—'), 500),
      case when cardinality(v_missing) > 0
        then 'Sin costo cargado, no se cobró: ' || array_to_string(v_missing, ', ') end,
      v_issue
    );
  end if;
  return v_issue;
end;
$$;
revoke all on function public.register_inventory_issue(date, uuid, uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.register_inventory_issue(date, uuid, uuid, uuid, text, text, jsonb) to authenticated;
