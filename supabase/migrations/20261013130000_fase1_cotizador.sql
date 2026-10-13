-- Fase 1 — Cotizador
--
-- Reemplaza el Excel "Cuadro de costos" (una hoja repetida por cliente).
-- Estructura: Cotización -> Ítems ("Sala / Panelado", "Sala / Bar"; lo que
-- en el Excel era cada "ITEM #") -> Renglones (módulos, gavetas,
-- revestimientos, subcontratos…).
--
-- Tablas:
--   quote_cost_inputs    insumos (láminas, canteo, pintura) y valores fijos
--                        de la empresa (utilidad, credit card fee, ITBMS…)
--   quote_catalog_items  catálogo: el precio "para cotizar" de cada renglón
--   quote_item_recipes   la "HOJA DE CALCULO oficial": cómo se llega al
--                        costo de cada renglón (solo-admin)
--   quotes / quote_sections / quote_lines
--
-- Dinero: numeric, NO centavos enteros como Planilla/Contratistas. Los
-- precios unitarios del catálogo vienen de la hoja de cálculo con más de
-- dos decimales (48.4581 por ML) y redondearlos a centavos cambia los
-- totales respecto al Excel. Los totales se calculan en la app
-- (src/lib/cotizador/pricing.ts); `quotes.total` es solo una copia para la
-- lista.
--
-- Cada renglón guarda su propia copia de nombre, unidad y precio: una
-- cotización enviada no cambia cuando después se edita el catálogo.
--
-- Seguridad:
--   - Cotizaciones, ítems y renglones: cualquier usuario de la app (admin
--     o vendedor) las lee y escribe.
--   - Catálogo e insumos: todos leen (hacen falta para cotizar); solo el
--     admin escribe.
--   - Recetas: solo admin (son costos internos).
--   anon sin acceso. Reutiliza private.is_admin(),
--   private.current_app_role() y private.touch_updated_at() de la Fase 1.

-- ============================================================================
-- 1. quote_cost_inputs — insumos y valores fijos
-- ============================================================================
create table public.quote_cost_inputs (
  key         text          primary key,
  -- 'insumo' = precio de material; 'default' = valor fijo de la empresa
  -- con el que nace cada ítem nuevo.
  kind        text          not null check (kind in ('insumo', 'default')),
  label       text          not null,
  value       numeric(14,4) not null check (value >= 0),
  unit        text          not null,
  sort_order  integer       not null default 0,
  updated_at  timestamptz   not null default now()
);

comment on table public.quote_cost_inputs is
  'Cotizador: precios de insumos (láminas, canteo, pintura) y valores fijos de la empresa (utilidad, margen de subcontratos, credit card fee, ITBMS).';

-- ============================================================================
-- 2. quote_catalog_items — catálogo de renglones
-- ============================================================================
create table public.quote_catalog_items (
  id          uuid          primary key default gen_random_uuid(),
  code        text          not null unique,
  category    text          not null check (category in (
                              'modulos', 'gavetas', 'tablillas', 'puertas', 'revestimientos', 'accesorios',
                              'espejos', 'vidrios', 'metales', 'tapiceria', 'iluminacion')),
  finish      text          check (finish is null or finish in ('aglomerado', 'blanco', 'pintado', 'chapilla')),
  name        text          not null,
  unit        text          not null check (unit in ('m2', 'ml', 'unidad')),
  -- Precio "para cotizar": costo por unidad, antes de utilidad.
  price       numeric(14,4) not null check (price >= 0),
  -- Cómo se dibuja en el visor 3D ('none' = no se dibuja).
  shape       text          not null default 'none' check (shape in (
                              'none', 'mod', 'gav', 'tab', 'pta', 'ptaL', 'rev', 'rev2', 'rev55', 'esp', 'vid', 'led')),
  -- Inactivar en vez de borrar: conserva lo que ya se cotizó.
  active      boolean       not null default true,
  sort_order  integer       not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

comment on table public.quote_catalog_items is
  'Cotizador: catálogo de renglones (módulos, gavetas, tablillas, puertas, revestimientos, accesorios y subcontratos) con su precio para cotizar.';

create index idx_quote_catalog_items_category on public.quote_catalog_items (category, sort_order);

-- ============================================================================
-- 3. quote_item_recipes — cómo se calcula el costo (solo admin)
-- ============================================================================
create table public.quote_item_recipes (
  item_id       uuid          primary key references public.quote_catalog_items (id) on delete cascade,
  sheet_key     text          not null references public.quote_cost_inputs (key),
  usable_m2     numeric(10,4) not null default 0,
  edge_ml       numeric(10,4) not null default 0,
  edge_key      text          not null references public.quote_cost_inputs (key),
  -- [[m2, clave de insumo de pintura], …]
  paint         jsonb         not null default '[]'::jsonb,
  labor         numeric(12,4) not null default 0,
  hardware_pct  numeric(8,5)  not null default 0,
  -- La tornillería se calcula sobre material + canteo ('edge') o
  -- material + pintura ('paint').
  hardware_base text          not null default 'edge' check (hardware_base in ('edge', 'paint')),
  fixed         numeric(12,4) not null default 0,
  fixed_label   text,
  base_m2       numeric(10,4) not null default 1 check (base_m2 > 0),
  updated_at    timestamptz   not null default now()
);

comment on table public.quote_item_recipes is
  'Cotizador: receta de costo de cada renglón (la "HOJA DE CALCULO oficial"). Solo-admin.';

-- ============================================================================
-- 4. quotes
-- ============================================================================
create table public.quotes (
  id              uuid          primary key default gen_random_uuid(),
  -- Número de cotización, escrito a mano por ahora (hoy lo asigna Alegra).
  number          text          not null default '',
  client_name     text          not null default '',
  designer_name   text          not null default '',
  project_name    text          not null default '',
  -- Se llena cuando la cotización se convierte en proyecto (etapa posterior).
  project_id      uuid          references public.projects (id) on delete set null,
  quote_date      date          not null default current_date,
  delivery_days   integer       not null default 65 check (delivery_days >= 0),
  status          text          not null default 'BORRADOR'
                                check (status in ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA')),
  lang            text          not null default 'es' check (lang in ('es', 'en')),
  -- Qué ve el cliente en el PDF: precio por ítem, por renglón o solo el total.
  pdf_detail      text          not null default 'section' check (pdf_detail in ('section', 'line', 'total')),
  discount_type   text          not null default 'pct' check (discount_type in ('pct', 'amount')),
  discount_value  numeric(14,4) not null default 0 check (discount_value >= 0),
  itbms_pct       numeric(6,3)  not null default 7 check (itbms_pct >= 0),
  notes           text          not null default '',
  -- Copia del total para la lista; la fuente es el cálculo de la app.
  total           numeric(14,2) not null default 0,
  created_by      uuid          default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table public.quotes is 'Cotizador: encabezado de una cotización.';
create index idx_quotes_status_date on public.quotes (status, quote_date desc);

-- ============================================================================
-- 5. quote_sections — ítems de la cotización ("Sala / Panelado")
-- ============================================================================
create table public.quote_sections (
  id                uuid          primary key default gen_random_uuid(),
  quote_id          uuid          not null references public.quotes (id) on delete cascade,
  sort_order        integer       not null default 0,
  location          text          not null default '',
  name              text          not null default '',
  kind              text          not null default 'Mueble',
  description       text          not null default '',
  util_pct          numeric(8,3)  not null default 130,
  sub_margin_pct    numeric(8,3)  not null default 50,
  waste_sheets      numeric(8,3)  not null default 1,
  waste_pct         numeric(8,3)  not null default 30,
  -- Precio de la lámina con el que se calculó el desperdicio (copia).
  waste_sheet_price numeric(14,4) not null default 0,
  design_3d         numeric(14,4) not null default 0,
  extra_labor       numeric(14,4) not null default 0,
  freight           numeric(14,4) not null default 0,
  commission_pct    numeric(8,3)  not null default 0,
  ccf_pct           numeric(8,3)  not null default 4,
  -- Dibujo 3D: una pared recta o dos paredes en esquina.
  wall_shape        text          not null default 'recta' check (wall_shape in ('recta', 'L')),
  corner_at         numeric(8,3),
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

comment on table public.quote_sections is
  'Cotizador: ítem de una cotización (ubicación + nombre, p. ej. "Sala / Bar") con sus márgenes y extras.';
create index idx_quote_sections_quote on public.quote_sections (quote_id, sort_order);

-- ============================================================================
-- 6. quote_lines — renglones de un ítem
-- ============================================================================
create table public.quote_lines (
  id               uuid          primary key default gen_random_uuid(),
  section_id       uuid          not null references public.quote_sections (id) on delete cascade,
  sort_order       integer       not null default 0,
  -- NULL en un renglón libre o si el ítem del catálogo se borró.
  item_id          uuid          references public.quote_catalog_items (id) on delete set null,
  -- Copia del catálogo al momento de cotizar.
  name             text          not null default '',
  category         text          not null check (category in (
                                   'modulos', 'gavetas', 'tablillas', 'puertas', 'revestimientos', 'accesorios', 'libre',
                                   'espejos', 'vidrios', 'metales', 'tapiceria', 'iluminacion')),
  finish           text          check (finish is null or finish in ('aglomerado', 'blanco', 'pintado', 'chapilla')),
  unit             text          not null check (unit in ('m2', 'ml', 'unidad')),
  shape            text          not null default 'none',
  -- 'med' = ancho × alto × piezas; 'dir' = cantidad escrita directo.
  mode             text          not null default 'dir' check (mode in ('med', 'dir')),
  width            numeric(10,4) not null default 0,
  height           numeric(10,4) not null default 0,
  pieces           numeric(10,2) not null default 1,
  qty              numeric(12,4) not null default 0,
  unit_price       numeric(14,6) not null default 0,
  price_overridden boolean       not null default false,
  -- Ubicación en el dibujo 3D; NULL = acomodo automático.
  wall             text          check (wall is null or wall in ('A', 'B')),
  pos_x            numeric(8,3),
  pos_y            numeric(8,3),
  host_line_id     uuid          references public.quote_lines (id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

comment on table public.quote_lines is
  'Cotizador: renglón de un ítem. Guarda su propia copia de nombre, unidad y precio para que una cotización enviada no cambie con el catálogo.';
create index idx_quote_lines_section on public.quote_lines (section_id, sort_order);
create index idx_quote_lines_item on public.quote_lines (item_id);
create index idx_quote_lines_host on public.quote_lines (host_line_id);

-- ============================================================================
-- 7. updated_at
-- ============================================================================
create trigger quote_cost_inputs_touch_updated_at   before update on public.quote_cost_inputs   for each row execute function private.touch_updated_at();
create trigger quote_catalog_items_touch_updated_at before update on public.quote_catalog_items for each row execute function private.touch_updated_at();
create trigger quote_item_recipes_touch_updated_at  before update on public.quote_item_recipes  for each row execute function private.touch_updated_at();
create trigger quotes_touch_updated_at              before update on public.quotes              for each row execute function private.touch_updated_at();
create trigger quote_sections_touch_updated_at      before update on public.quote_sections      for each row execute function private.touch_updated_at();
create trigger quote_lines_touch_updated_at         before update on public.quote_lines         for each row execute function private.touch_updated_at();

-- ============================================================================
-- 8. RLS
-- ============================================================================
alter table public.quote_cost_inputs   enable row level security;
alter table public.quote_catalog_items enable row level security;
alter table public.quote_item_recipes  enable row level security;
alter table public.quotes              enable row level security;
alter table public.quote_sections      enable row level security;
alter table public.quote_lines         enable row level security;

-- Insumos y catálogo: todos los usuarios de la app leen; solo admin escribe.
create policy "quote_cost_inputs_read"  on public.quote_cost_inputs for select to authenticated
  using (private.current_app_role() in ('admin', 'vendedor'));
create policy "quote_cost_inputs_admin_insert" on public.quote_cost_inputs for insert to authenticated with check (private.is_admin());
create policy "quote_cost_inputs_admin_update" on public.quote_cost_inputs for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "quote_cost_inputs_admin_delete" on public.quote_cost_inputs for delete to authenticated using (private.is_admin());

create policy "quote_catalog_items_read" on public.quote_catalog_items for select to authenticated
  using (private.current_app_role() in ('admin', 'vendedor'));
create policy "quote_catalog_items_admin_insert" on public.quote_catalog_items for insert to authenticated with check (private.is_admin());
create policy "quote_catalog_items_admin_update" on public.quote_catalog_items for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "quote_catalog_items_admin_delete" on public.quote_catalog_items for delete to authenticated using (private.is_admin());

-- Recetas: solo admin.
create policy "quote_item_recipes_admin_all" on public.quote_item_recipes for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Cotizaciones: cualquier usuario de la app.
create policy "quotes_app_users_all" on public.quotes for all to authenticated
  using (private.current_app_role() in ('admin', 'vendedor'))
  with check (private.current_app_role() in ('admin', 'vendedor'));
create policy "quote_sections_app_users_all" on public.quote_sections for all to authenticated
  using (private.current_app_role() in ('admin', 'vendedor'))
  with check (private.current_app_role() in ('admin', 'vendedor'));
create policy "quote_lines_app_users_all" on public.quote_lines for all to authenticated
  using (private.current_app_role() in ('admin', 'vendedor'))
  with check (private.current_app_role() in ('admin', 'vendedor'));

-- ============================================================================
-- 9. Grants — anon nada; authenticated queda filtrado por RLS
-- ============================================================================
revoke all on public.quote_cost_inputs, public.quote_catalog_items, public.quote_item_recipes,
              public.quotes, public.quote_sections, public.quote_lines from anon;
grant select, insert, update, delete on public.quote_cost_inputs, public.quote_catalog_items, public.quote_item_recipes,
              public.quotes, public.quote_sections, public.quote_lines to authenticated;

-- ============================================================================
-- 10. Seed — insumos, catálogo y recetas del Excel "Cuadro de costos"
--     Donde la plantilla de cotización y la hoja de cálculo oficial no
--     coinciden, el precio para cotizar es el más alto de los dos.
-- ============================================================================
insert into public.quote_cost_inputs (key, kind, label, value, unit, sort_order) values
  ('lamW', 'insumo', 'Ancho de lámina', 2.44, 'm', 10),
  ('lamH', 'insumo', 'Alto de lámina', 2.1, 'm', 20),
  ('lamAglo', 'insumo', 'Lámina aglomerado', 210, 'usd', 30),
  ('lamBlanco', 'insumo', 'Lámina aglomerado blanco', 60, 'usd', 40),
  ('lamBlancoArea', 'insumo', 'Superficie de lámina blanca', 5.0875, 'm2', 50),
  ('lamMdf', 'insumo', 'Lámina MDF', 124, 'usd', 60),
  ('lamChap', 'insumo', 'Lámina chapilla', 185, 'usd', 70),
  ('canteo', 'insumo', 'Canteo', 2.7, 'usd_ml', 80),
  ('canteoReng', 'insumo', 'Canteo rengrosado', 3.4, 'usd_ml', 90),
  ('canteoChap', 'insumo', 'Canteo chapilla', 3.1, 'usd_ml', 100),
  ('pintLiso', 'insumo', 'Pintura lisa', 47, 'usd_m2', 110),
  ('pintList', 'insumo', 'Pintura listones', 52, 'usd_m2', 120),
  ('pintChap', 'insumo', 'Acabado chapilla', 52, 'usd_m2', 130),
  ('def_util', 'default', 'Utilidad Ebony', 130, 'pct', 10),
  ('def_sub_margin', 'default', 'Margen de subcontratos', 50, 'pct', 20),
  ('def_waste_sheets', 'default', 'Láminas adicionales', 1, 'u', 30),
  ('def_waste_pct', 'default', 'Desperdicio', 30, 'pct', 40),
  ('def_design3d', 'default', 'Diseño 3D en SketchUp', 30, 'usd', 50),
  ('def_extra_labor', 'default', 'Mano de obra adicional', 25, 'usd', 60),
  ('def_freight', 'default', 'Flete de material', 30, 'usd', 70),
  ('def_commission', 'default', 'Comisión de diseñadora', 0, 'pct', 80),
  ('def_ccf', 'default', 'Credit card fee', 4, 'pct', 90),
  ('def_itbms', 'default', 'ITBMS', 7, 'pct', 100),
  ('def_delivery_days', 'default', 'Días de entrega', 65, 'dias', 110);

insert into public.quote_catalog_items (code, category, finish, name, unit, price, shape, sort_order) values
  ('mod-ag', 'modulos', 'aglomerado', 'Módulo aglomerado', 'm2', 165, 'mod', 10),
  ('mod-bl', 'modulos', 'blanco', 'Módulo aglomerado blanco', 'm2', 127.98, 'mod', 20),
  ('mod-pi', 'modulos', 'pintado', 'Módulo pintado', 'm2', 295.95, 'mod', 30),
  ('mod-ch', 'modulos', 'chapilla', 'Módulo chapilla', 'm2', 359.71, 'mod', 40),
  ('mod-cu', 'modulos', 'pintado', 'Módulo curvo', 'm2', 280, 'mod', 50),
  ('gav-es-ag', 'gavetas', 'aglomerado', 'Gaveta · estructura aglomerado', 'ml', 57.35, 'none', 60),
  ('gav-fr-ag', 'gavetas', 'aglomerado', 'Gaveta · frente aglomerado', 'm2', 65.89, 'gav', 70),
  ('gav-go-ag', 'gavetas', 'aglomerado', 'Gola para gaveta aglomerado', 'ml', 11.2, 'none', 80),
  ('gav-es-pi', 'gavetas', 'pintado', 'Gaveta · estructura pintada', 'ml', 108.63, 'none', 90),
  ('gav-fr-pi', 'gavetas', 'pintado', 'Gaveta · frente pintado', 'm2', 95.49, 'gav', 100),
  ('gav-go-pi', 'gavetas', 'pintado', 'Gola para gaveta pintada', 'ml', 16.93, 'none', 110),
  ('gav-es-ch', 'gavetas', 'chapilla', 'Gaveta · estructura chapilla', 'ml', 139.87, 'none', 120),
  ('gav-fr-ch', 'gavetas', 'chapilla', 'Gaveta · frente chapilla', 'm2', 139.42, 'gav', 130),
  ('tab-ag', 'tablillas', 'aglomerado', 'Tablilla aglomerado', 'm2', 50.6, 'tab', 140),
  ('tab-ag-r', 'tablillas', 'aglomerado', 'Tablilla rengrosada aglomerado', 'm2', 87.7, 'tab', 150),
  ('tab-pi', 'tablillas', 'pintado', 'Tablilla pintada', 'm2', 122.09, 'tab', 160),
  ('tab-pi-r', 'tablillas', 'pintado', 'Tablilla rengrosada pintada', 'm2', 144.13, 'tab', 170),
  ('tab-ch', 'tablillas', 'chapilla', 'Tablilla chapilla', 'm2', 149.1, 'tab', 180),
  ('tab-ch-r', 'tablillas', 'chapilla', 'Tablilla doble chapilla', 'm2', 182.5, 'tab', 190),
  ('pta-ag', 'puertas', 'aglomerado', 'Puerta aglomerado', 'm2', 61.26, 'pta', 200),
  ('pta-ag-l', 'puertas', 'aglomerado', 'Puerta aglomerado con listones', 'm2', 168.14, 'ptaL', 210),
  ('pta-pi', 'puertas', 'pintado', 'Puerta pintada', 'm2', 127.23, 'pta', 220),
  ('pta-pi-l', 'puertas', 'pintado', 'Puerta pintada con listones', 'm2', 150.04, 'ptaL', 230),
  ('pta-ch', 'puertas', 'chapilla', 'Puerta chapilla', 'm2', 162.05, 'pta', 240),
  ('pta-ch-l', 'puertas', 'chapilla', 'Puerta chapilla con listones', 'm2', 274.74, 'ptaL', 250),
  ('rev-ag', 'revestimientos', 'aglomerado', 'Revestimiento liso aglomerado', 'm2', 97.5, 'rev', 260),
  ('rev-ag-55', 'revestimientos', 'aglomerado', 'Rev. listones 5.5 cm aglomerado', 'm2', 211.8, 'rev55', 270),
  ('rev-ag-2', 'revestimientos', 'aglomerado', 'Rev. listones 2 cm aglomerado', 'm2', 209.55, 'rev2', 280),
  ('rev-pi', 'revestimientos', 'pintado', 'Revestimiento liso pintado', 'm2', 134.5, 'rev', 290),
  ('rev-pi-55', 'revestimientos', 'pintado', 'Rev. listones 5.5 cm pintado', 'm2', 159.5, 'rev55', 300),
  ('rev-pi-2', 'revestimientos', 'pintado', 'Rev. listones 2 cm pintado', 'm2', 161.5, 'rev2', 310),
  ('rev-ch', 'revestimientos', 'chapilla', 'Revestimiento liso chapilla', 'm2', 184.3, 'rev', 320),
  ('rev-ch-55', 'revestimientos', 'chapilla', 'Rev. listones 5.5 cm chapilla', 'm2', 268.8, 'rev55', 330),
  ('rev-ch-2', 'revestimientos', 'chapilla', 'Rev. listones 2 cm chapilla', 'm2', 267.77, 'rev2', 340),
  ('ac-tubo', 'accesorios', null, 'Tubo', 'unidad', 4.27, 'none', 350),
  ('ac-stubo', 'accesorios', null, 'Soporte de tubo', 'unidad', 1.75, 'none', 360),
  ('ac-pata', 'accesorios', null, 'Pata', 'unidad', 1.5, 'none', 370),
  ('ac-rueda', 'accesorios', null, 'Rueda', 'unidad', 7.5, 'none', 380),
  ('ac-bis-r', 'accesorios', null, 'Bisagra recta', 'unidad', 3.6, 'none', 390),
  ('ac-bis-c', 'accesorios', null, 'Bisagra de cangrejo', 'unidad', 6.1, 'none', 400),
  ('ac-brazo', 'accesorios', null, 'Brazo mecánico', 'unidad', 12.5, 'none', 410),
  ('ac-tir', 'accesorios', null, 'Tirador', 'unidad', 5, 'none', 420),
  ('ac-riel-b', 'accesorios', null, 'Riel oculto Blum', 'unidad', 47, 'none', 430),
  ('ac-riel-e', 'accesorios', null, 'Riel oculto económico', 'unidad', 25, 'none', 440),
  ('ac-riel-l', 'accesorios', null, 'Riel lateral de extensión', 'unidad', 8, 'none', 450),
  ('ac-exp', 'accesorios', null, 'Expulsor', 'unidad', 6.5, 'none', 460),
  ('ac-ht', 'accesorios', null, 'Tubo de High Tack', 'unidad', 8, 'none', 470),
  ('ac-perf', 'accesorios', null, 'Perfil de metal', 'unidad', 405, 'none', 480),
  ('sb-esp-c', 'espejos', null, 'Espejo claro', 'm2', 185, 'esp', 490),
  ('sb-esp-b', 'espejos', null, 'Espejo bronce', 'm2', 181, 'esp', 500),
  ('sb-esp-g', 'espejos', null, 'Espejo gris / fumé', 'm2', 195, 'esp', 510),
  ('sb-vid-6', 'vidrios', null, 'Vidrio templado 6 mm', 'm2', 64, 'vid', 520),
  ('sb-vid-10', 'vidrios', null, 'Vidrio templado 10 mm', 'm2', 82, 'vid', 530),
  ('sb-pvid', 'vidrios', null, 'Puerta de vidrio + perfil aluminio', 'ml', 286, 'none', 540),
  ('sb-svar', 'metales', null, 'Soporte de varilla', 'unidad', 2.75, 'none', 550),
  ('sb-sesc', 'metales', null, 'Soporte de escritorio', 'ml', 59.52, 'none', 560),
  ('sb-est', 'metales', null, 'Estructuras varias (metal)', 'ml', 65, 'none', 570),
  ('sb-coj', 'tapiceria', null, 'Cojín (foam 3")', 'm2', 133, 'none', 580),
  ('sb-bast', 'tapiceria', null, 'Bastidor (foam 3")', 'm2', 113, 'none', 590),
  ('sb-tap-larg', 'tapiceria', null, 'Larguero de cama (foam 1/2")', 'm2', 71, 'none', 600),
  ('sb-tap-esps', 'tapiceria', null, 'Espaldar seccionado (foam 2")', 'm2', 100, 'none', 610),
  ('sb-tap-espl', 'tapiceria', null, 'Espaldar liso (foam 2")', 'm2', 89, 'none', 620),
  ('sb-led', 'iluminacion', null, 'Luces LED', 'ml', 57, 'led', 630);

insert into public.quote_item_recipes
  (item_id, sheet_key, usable_m2, edge_ml, edge_key, paint, labor, hardware_pct, hardware_base, fixed, fixed_label, base_m2)
select i.id, r.sheet_key, r.usable_m2, r.edge_ml, r.edge_key, r.paint::jsonb, r.labor, r.hardware_pct, r.hardware_base, r.fixed, r.fixed_label, r.base_m2
from (values
  ('mod-ag', 'lamAglo', 6.82, 6.74, 'canteo', '[]', 89.37, 0.03, 'edge', 0, null, 2.4),
  ('mod-bl', 'lamBlanco', 6.82, 6.74, 'canteo', '[]', 68, 0.03, 'edge', 0, null, 2.4),
  ('mod-pi', 'lamMdf', 6.82, 0, 'canteo', '[[10.12,"pintLiso"]]', 68, 0.0025, 'paint', 0, null, 2.4),
  ('mod-ch', 'lamChap', 6.82, 6.74, 'canteoChap', '[[10.12,"pintChap"]]', 68, 0.0025, 'paint', 0, null, 2.4),
  ('gav-es-ag', 'lamAglo', 0.9145, 4.91, 'canteo', '[]', 6, 0.012, 'edge', 0, null, 1),
  ('gav-es-pi', 'lamMdf', 1.274, 2.94, 'canteo', '[[1.3,"pintLiso"]]', 6, 0.03, 'paint', 0, null, 1),
  ('gav-fr-pi', 'lamMdf', 1.26, 0, 'canteo', '[[1,"pintLiso"]]', 16, 0, 'edge', 2, 'High Tack', 1),
  ('gav-es-ch', 'lamChap', 1.274, 5.44, 'canteoChap', '[[1.3,"pintChap"]]', 6, 0.03, 'paint', 0, null, 1),
  ('gav-fr-ch', 'lamChap', 1.26, 7.72, 'canteoChap', '[[1,"pintChap"]]', 16, 0, 'edge', 2, 'High Tack', 1),
  ('tab-ag', 'lamAglo', 0.543, 0.97, 'canteo', '[]', 2.5, 0, 'edge', 0.8, 'Soportes', 0.5568),
  ('tab-ag-r', 'lamAglo', 1.05, 0.97, 'canteoReng', '[]', 2.5, 0, 'edge', 0, null, 0.5568),
  ('tab-pi', 'lamMdf', 0.543, 0, 'canteo', '[[1.1136,"pintLiso"]]', 2.5, 0, 'edge', 0, null, 0.5568),
  ('tab-pi-r', 'lamMdf', 1.05, 0, 'canteo', '[[1.1136,"pintLiso"]]', 2.5, 0, 'edge', 0, null, 0.5568),
  ('tab-ch', 'lamChap', 0.543, 0.97, 'canteoChap', '[[1.1136,"pintChap"]]', 2.5, 0, 'edge', 0, null, 0.5568),
  ('tab-ch-r', 'lamChap', 1.05, 0.97, 'canteoReng', '[[1.1136,"pintChap"]]', 2.5, 0, 'edge', 0, null, 0.5568),
  ('pta-ag', 'lamAglo', 1.44, 6, 'canteo', '[]', 13, 0, 'edge', 0, null, 1.44),
  ('pta-ag-l', 'lamAglo', 2.56, 46, 'canteo', '[]', 13, 0, 'edge', 0, null, 1.44),
  ('pta-pi', 'lamMdf', 1.44, 0, 'canteo', '[[2.88,"pintLiso"]]', 13, 0, 'edge', 0, null, 1.44),
  ('pta-pi-l', 'lamMdf', 2.5, 0, 'canteo', '[[1.44,"pintLiso"],[1.44,"pintList"]]', 13, 0, 'edge', 0, null, 1.44),
  ('pta-ch', 'lamChap', 1.44, 6, 'canteoChap', '[[2.88,"pintChap"]]', 13, 0, 'edge', 0, null, 1.44),
  ('pta-ch-l', 'lamChap', 2.5, 46, 'canteoChap', '[[1.44,"pintChap"],[1.44,"pintList"]]', 13, 0, 'edge', 0, null, 1.44),
  ('rev-ag', 'lamAglo', 1.26, 7.72, 'canteo', '[]', 16, 0, 'edge', 2, 'High Tack', 1),
  ('rev-ag-55', 'lamAglo', 2.03, 37.26, 'canteo', '[]', 26, 0, 'edge', 2, 'High Tack', 1),
  ('rev-ag-2', 'lamAglo', 1.78, 37.26, 'canteo', '[]', 34, 0, 'edge', 2, 'High Tack', 1),
  ('rev-pi', 'lamMdf', 1.26, 0, 'canteo', '[[1,"pintLiso"]]', 16, 0, 'edge', 2, 'High Tack', 1),
  ('rev-pi-55', 'lamMdf', 2.03, 0, 'canteo', '[[1,"pintList"]]', 26, 0, 'edge', 2, 'High Tack', 1),
  ('rev-pi-2', 'lamMdf', 1.78, 0, 'canteo', '[[1,"pintList"]]', 34, 0, 'edge', 2, 'High Tack', 1),
  ('rev-ch', 'lamChap', 1.26, 7.72, 'canteoChap', '[[1,"pintChap"]]', 16, 0, 'edge', 2, 'High Tack', 1),
  ('rev-ch-55', 'lamChap', 2.03, 37.26, 'canteoChap', '[[1,"pintList"]]', 26, 0, 'edge', 2, 'High Tack', 1),
  ('rev-ch-2', 'lamChap', 1.78, 37.26, 'canteoChap', '[[1,"pintList"]]', 34, 0, 'edge', 2, 'High Tack', 1)
) as r (code, sheet_key, usable_m2, edge_ml, edge_key, paint, labor, hardware_pct, hardware_base, fixed, fixed_label, base_m2)
join public.quote_catalog_items i on i.code = r.code;
