-- Permiso "Herramientas" (almacen_herramientas), dentro de Almacén: crear y
-- editar herramientas y su foto, sin ver costos ni ajustar existencias.
-- Cambiar el estado a mano (dañada / reparación / perdida) o dar de baja una
-- herramienta queda para Ajustes de inventario o Compras: quien custodia las
-- herramientas no puede ocultar una pérdida (no ser juez y parte).

alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes', 'almacen_herramientas', 'directorio',
                          'accesos', 'form_autorizaciones', 'form_registro', 'inspecciones']::text[]);

drop policy if exists "inventory_tools_write" on public.inventory_tools;
create policy "inventory_tools_write" on public.inventory_tools for all to authenticated
  using (private.has_module('almacen_ajustes') or private.has_module('almacen_compras') or private.has_module('almacen_herramientas'))
  with check (private.has_module('almacen_ajustes') or private.has_module('almacen_compras') or private.has_module('almacen_herramientas'));

drop policy if exists "inventory_photos_tools_insert" on storage.objects;
create policy "inventory_photos_tools_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inventory-photos' and name like 'tools/%'
              and (private.has_module('almacen_ajustes') or private.has_module('almacen_compras') or private.has_module('almacen_herramientas')));
drop policy if exists "inventory_photos_tools_delete" on storage.objects;
create policy "inventory_photos_tools_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inventory-photos' and name like 'tools/%'
         and (private.has_module('almacen_ajustes') or private.has_module('almacen_compras') or private.has_module('almacen_herramientas')));

-- Solo Ajustes o Compras cambian el estado a mano o dan de baja. Prestar y
-- devolver (lend_tools / return_tool, security definer) no pasan por aquí.
create or replace function private.inventory_tools_status_by_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if private.has_module('almacen_ajustes') or private.has_module('almacen_compras') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'disponible' or not new.active then
      raise exception 'Solo Ajustes de inventario o Compras crean una herramienta dañada o de baja.';
    end if;
  elsif new.status is distinct from old.status or new.active is distinct from old.active then
    raise exception 'Solo Ajustes de inventario o Compras cambian el estado de una herramienta o la dan de baja.';
  end if;
  return new;
end;
$$;
drop trigger if exists inventory_tools_status_by_role on public.inventory_tools;
create trigger inventory_tools_status_by_role before insert or update on public.inventory_tools
  for each row execute function private.inventory_tools_status_by_role();
