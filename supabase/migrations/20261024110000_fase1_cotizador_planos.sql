-- Fase 1 — Cotizador · lectura de planos
--
-- Un plano subido (PDF o imagen) se lee y se convierte en PIEZAS con su
-- medida y su lugar en la elevación (módulos, puertas, gavetas,
-- tablillas, columnas, panelados, y lo que no se cobra: piedra, TV, A/C).
-- De las piezas salen los renglones del ítem y su dibujo 3D exacto.
--
--   quote_plans                lectura de un plano: archivo, piezas y
--                              respuestas del cuestionario
--   quote_sections.plan_id     el ítem que se generó desde ese plano
--   quote_lines.piece_ids      qué piezas cubre cada renglón (para
--                              resaltarlas en el dibujo y medir cuánto
--                              del mueble quedó cotizado)
--   catálogo                   + "Soporte de tablilla" (antes ítem libre)
--   storage                    bucket privado "planos"
--
-- Seguridad: igual que las cotizaciones — cualquier usuario de la app
-- (admin o vendedor); anon sin acceso.

-- ============================================================================
-- 1. quote_plans
-- ============================================================================
create table public.quote_plans (
  id          uuid        primary key default gen_random_uuid(),
  quote_id    uuid        not null references public.quotes (id) on delete cascade,
  -- Ruta dentro del bucket "planos"; NULL en la lectura de ejemplo.
  file_path   text,
  file_name   text        not null default '',
  -- 'ia' = leído con Claude; 'ejemplo' = lectura de referencia (The Woods).
  source      text        not null default 'ia' check (source in ('ia', 'ejemplo')),
  model       text,
  title       text        not null default '',
  -- PlanPiece[] (ver src/types/plan.ts)
  pieces      jsonb       not null default '[]'::jsonb,
  -- PlanAnswers (cuestionario)
  answers     jsonb       not null default '{}'::jsonb,
  doubts      jsonb       not null default '[]'::jsonb,
  created_by  uuid        default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.quote_plans is
  'Cotizador: lectura de un plano (piezas con medida y posición) y respuestas del cuestionario.';
create index idx_quote_plans_quote on public.quote_plans (quote_id);

create trigger quote_plans_touch_updated_at
  before update on public.quote_plans
  for each row execute function private.touch_updated_at();

alter table public.quote_plans enable row level security;
create policy "quote_plans_app_users_all" on public.quote_plans for all to authenticated
  using (private.current_app_role() in ('admin', 'vendedor'))
  with check (private.current_app_role() in ('admin', 'vendedor'));
revoke all on public.quote_plans from anon;
grant select, insert, update, delete on public.quote_plans to authenticated;

-- ============================================================================
-- 2. Enlaces desde ítems y renglones
-- ============================================================================
alter table public.quote_sections
  add column plan_id uuid references public.quote_plans (id) on delete set null;
comment on column public.quote_sections.plan_id is
  'Plano del que se generó el ítem. Con plano, el dibujo 3D sale de sus piezas (exacto); sin plano, de los renglones (aproximado).';

alter table public.quote_lines
  add column piece_ids text[] not null default '{}';
comment on column public.quote_lines.piece_ids is
  'Piezas del plano que cubre el renglón (ids dentro de quote_plans.pieces).';

-- ============================================================================
-- 3. Catálogo: soporte de tablilla
-- ============================================================================
insert into public.quote_catalog_items (code, category, finish, name, unit, price, shape, sort_order)
values ('ac-sop-tab', 'accesorios', null, 'Soporte de tablilla', 'unidad', 0.20, 'none', 455)
on conflict (code) do nothing;

-- ============================================================================
-- 4. Storage — bucket privado para los planos
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planos', 'planos', false, 26214400, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "planos_app_users_select" on storage.objects for select to authenticated
  using (bucket_id = 'planos' and private.current_app_role() in ('admin', 'vendedor'));
create policy "planos_app_users_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'planos' and private.current_app_role() in ('admin', 'vendedor'));
create policy "planos_app_users_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'planos' and private.current_app_role() in ('admin', 'vendedor'));
