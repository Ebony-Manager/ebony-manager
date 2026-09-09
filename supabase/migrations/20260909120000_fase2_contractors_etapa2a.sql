-- Fase 2 — Contratistas · ETAPA 2-A: contrato del proyecto + asignaciones
--
-- Objetivo: capturar la información necesaria para medir performance
-- (días por m², avance por contratista). Dos cambios, ambos seguros:
--
--   1. `projects` se amplía con los campos de "contrato" — TODO ADITIVO:
--      columnas nuevas, todas NULLABLE, sin default que reescriba filas
--      existentes, sin recrear la tabla ni tocar datos. La RLS, la policy
--      `projects_admin_all` y los grants de `projects` ya existen desde la
--      Etapa 1 (20260907130000_fase2_contractors.sql) — acá no se tocan.
--
--   2. Tabla nueva `project_assignments`: qué contratista trabaja en qué
--      proyecto, con sus fechas y los m² que le tocan (para el cálculo de
--      días/m²). Un contratista aparece UNA sola vez por proyecto (unique).
--
-- Seguridad: mismo patrón que Planilla / Contratistas Etapa 1. Solo-admin
-- vía RLS contra `private.is_admin()` (y `requireAdmin()` en la app);
-- `anon` sin acceso; trigger de `updated_at` reutilizando
-- `private.touch_updated_at()` — ambos helpers definidos en
-- 20260906170000_fase1_auth_rls.sql. Este archivo NO los redefine.
--
-- Dinero: no aplica acá. Las áreas van en `numeric(12,2)` de m², igual
-- que `contractor_ledger_entries.mt2`.
--
-- Aplicada el 2026-09-09 vía el MCP de Supabase (proyecto Ebony). Sin
-- carga de datos.

-- ============================================================================
-- 1. projects — campos de "contrato" (aditivo, todo opcional)
-- ============================================================================
alter table public.projects
  add column scope          text,
  add column furniture_type text,
  add column material_color text,
  add column specs          text,
  add column payment_terms  text,
  add column total_mt2      numeric(12,2)
                            check (total_mt2 is null or total_mt2 >= 0);

comment on column public.projects.scope          is 'Alcance / qué incluye el proyecto (texto libre).';
comment on column public.projects.furniture_type is 'Tipo de mueble principal (closet, cocina, panelería…), texto libre.';
comment on column public.projects.material_color is 'Color del material / acabado (texto libre).';
comment on column public.projects.specs          is 'Especificaciones adicionales (texto libre).';
comment on column public.projects.payment_terms  is 'Acuerdo de pago (texto libre).';
comment on column public.projects.total_mt2      is 'm² totales del proyecto. NULL si todavía no se sabe; nunca negativo.';

-- ============================================================================
-- 2. project_assignments — un contratista asignado a un proyecto
-- ============================================================================
create table public.project_assignments (
  id             uuid          primary key default gen_random_uuid(),

  -- Proyecto y contratista de la asignación. Si se borra cualquiera de
  -- los dos, la asignación se va con él (cascade): sin asignaciones
  -- huérfanas.
  project_id     uuid          not null references public.projects (id)    on delete cascade,
  contractor_id  uuid          not null references public.contractors (id) on delete cascade,

  -- Ventana de trabajo de ESTE contratista en ESTE proyecto. Ambas
  -- opcionales; sirven para medir duración real vs. estimada.
  start_date     date,
  end_date       date,

  -- m² que hace este contratista en este proyecto (no los del proyecto
  -- entero). Es el denominador de "días por m²". Opcional; nunca negativo.
  assigned_mt2   numeric(12,2) check (assigned_mt2 is null or assigned_mt2 >= 0),

  notes          text,

  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),

  -- Un mismo contratista no se asigna dos veces al mismo proyecto.
  constraint project_assignments_project_contractor_key
    unique (project_id, contractor_id),

  -- Guarda de sentido común (extra, no pedida explícitamente — quitar si
  -- no la quieres): si vienen las dos fechas, el fin no va antes del
  -- inicio.
  constraint project_assignments_dates_ordered
    check (start_date is null or end_date is null or end_date >= start_date)
);

comment on table public.project_assignments is
  'Asignación de un contratista a un proyecto: fechas y m² que le tocan, para medir performance (días/m²). Único por (project_id, contractor_id).';

-- El unique (project_id, contractor_id) ya cubre las búsquedas por
-- proyecto; se agrega el índice por contratista para "sus asignaciones".
create index idx_project_assignments_contractor
  on public.project_assignments (contractor_id);

alter table public.project_assignments enable row level security;

-- ============================================================================
-- 3. updated_at — trigger reutilizando el helper de la Fase 1
-- ============================================================================
create trigger project_assignments_touch_updated_at
  before update on public.project_assignments
  for each row execute function private.touch_updated_at();

-- ============================================================================
-- 4. RLS — solo admin (mismo patrón y helper que Planilla / Etapa 1)
-- ============================================================================
create policy "project_assignments_admin_all"
  on public.project_assignments for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ============================================================================
-- 5. Grants — anon nada; authenticated queda filtrado por RLS
-- ============================================================================
revoke all on public.project_assignments from anon;
grant select, insert, update, delete on public.project_assignments to authenticated;
