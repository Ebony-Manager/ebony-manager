-- Directorio: los proveedores dejan de ser "del Almacén" y pasan a ser el
-- directorio de la empresa (materiales y servicios: técnicos, mecánico,
-- transporte, subcontratos…). Los contratistas siguen en Personal.
--
-- * Rubros (uno o varios, lista fija) y especialidad libre ("técnico de qué").
-- * Permiso nuevo `directorio`: ver y editar el directorio sin tener Almacén.
--   Almacén lo sigue viendo y Compras lo sigue editando.

-- 1. Permiso
alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes', 'directorio']::text[]);

-- 2. Rubros y especialidad
alter table public.suppliers add column if not exists rubros text[] not null default '{}';
alter table public.suppliers add column if not exists specialty text;
alter table public.suppliers drop constraint if exists suppliers_rubros_check;
alter table public.suppliers add constraint suppliers_rubros_check
  check (rubros <@ array['ferreteria', 'herrajes', 'madera_laminas', 'iluminacion', 'pintura',
                         'tecnico_maquinaria', 'mecanico', 'transporte', 'mantenimiento', 'subcontrato']::text[]);
comment on column public.suppliers.rubros is 'Rubros del proveedor (lista fija; ver SUPPLIER_RUBROS en la app).';
comment on column public.suppliers.specialty is 'Especialidad libre: de qué es técnico, qué marca maneja, etc.';
comment on table public.suppliers is 'Directorio de proveedores de materiales y de servicios. Sin cuentas bancarias.';

-- 3. Quién lo ve y quién lo edita
drop policy if exists "suppliers_read" on public.suppliers;
create policy "suppliers_read" on public.suppliers for select to authenticated
  using (private.has_module('almacen') or private.has_module('directorio'));
drop policy if exists "suppliers_write" on public.suppliers;
create policy "suppliers_write" on public.suppliers for all to authenticated
  using (private.has_module('almacen_compras') or private.has_module('directorio'))
  with check (private.has_module('almacen_compras') or private.has_module('directorio'));

-- 4. Los dos proveedores que ya existen
update public.suppliers set rubros = array['iluminacion'], specialty = coalesce(specialty, 'Cintas LED (importación)')
  where name ilike 'COXO%' and rubros = '{}';
update public.suppliers set rubros = array['herrajes'], specialty = coalesce(specialty, 'Bisagras ocultas y manigueta (importación)')
  where name ilike 'IISDOO%' and rubros = '{}';
