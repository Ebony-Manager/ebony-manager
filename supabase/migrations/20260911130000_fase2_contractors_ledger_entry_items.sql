-- Fase 2 — Contratistas · ítems de trabajo de un movimiento
--
-- Objetivo: cuando un movimiento del estado de cuenta es categoría
-- 'trabajo' ("Proyecto"), permitir anexarle varias líneas armadas desde
-- el catálogo `labor_rates` (descripción, unidad, cantidad, precio) en
-- vez de escribir el monto a mano. El monto del movimiento pasa a ser la
-- SUMA de sus ítems cuando tiene al menos uno.
--
-- CONGELADO, no un JOIN en vivo: descripcion/fase/unidad/precio se
-- copian de `labor_rates` al momento de agregar el ítem y NUNCA cambian
-- después, aunque la tarifa original cambie o se borre — mismo criterio
-- que `contractor_ledger_entries.amount_cents` (el monto final siempre
-- manda, no se recalcula al leer). `labor_rate_id` es solo trazabilidad
-- (qué tarifa se usó); por eso es NULLABLE con `on delete set null`: si
-- la tarifa se borra más adelante, el ítem conserva sus datos completos.
--
-- Dinero: integer de centavos enteros, igual que el resto de la app.
--
-- Seguridad: mismo patrón que el resto de Contratistas. Solo-admin vía
-- RLS contra private.is_admin() (helper definido en
-- 20260906170000_fase1_auth_rls.sql, no se redefine acá); anon sin
-- acceso. Sin trigger de updated_at: los ítems de un movimiento se
-- reemplazan completos (borrar + insertar) cada vez que se guarda el
-- formulario, nunca se editan campo por campo.
--
-- Aplicada el 2026-09-11 vía el MCP de Supabase (proyecto Ebony).

create table public.contractor_ledger_entry_items (
  id                     uuid        primary key default gen_random_uuid(),

  -- Movimiento dueño del ítem. Si se borra el movimiento, se borran sus
  -- ítems con él (cascade) — no hay ítems huérfanos.
  ledger_entry_id        uuid        not null
                                     references public.contractor_ledger_entries (id) on delete cascade,

  -- Tarifa de origen, solo trazabilidad. NULL si la tarifa se borra más
  -- adelante; el ítem ya tiene sus propios datos congelados abajo.
  labor_rate_id          uuid        references public.labor_rates (id) on delete set null,

  -- Datos "congelados" de la tarifa al momento de agregar el ítem.
  descripcion            text        not null,
  fase                   text        check (fase is null or fase in ('armado', 'instalacion')),
  unidad                 text        not null check (unidad in ('m2', 'ml', 'unidad')),
  precio_unitario_cents  integer     not null check (precio_unitario_cents >= 0),

  -- Cantidad que cargó el usuario para este ítem (m², ml o unidades).
  cantidad               numeric(10,2) not null check (cantidad > 0),

  -- = round(cantidad * precio_unitario_cents), calculado y congelado al
  -- guardar — igual que el resto del dinero en la app, nunca se
  -- recalcula al leer.
  subtotal_cents         integer     not null check (subtotal_cents >= 0),

  created_at             timestamptz not null default now()
);

comment on table public.contractor_ledger_entry_items is
  'Líneas de trabajo de un movimiento (categoría "trabajo"), armadas desde labor_rates. Datos congelados al momento de agregar el ítem — nunca un join en vivo. El monto del movimiento = suma de subtotal_cents cuando tiene al menos un ítem.';

create index idx_contractor_ledger_entry_items_entry
  on public.contractor_ledger_entry_items (ledger_entry_id);

alter table public.contractor_ledger_entry_items enable row level security;

create policy "contractor_ledger_entry_items_admin_all"
  on public.contractor_ledger_entry_items for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

revoke all on public.contractor_ledger_entry_items from anon;
grant select, insert, update, delete on public.contractor_ledger_entry_items to authenticated;
