-- Settings → Cotizaciones: las Condiciones Generales se editan desde la app
-- (solo el admin) en vez de estar en el código. Cada cotización guarda una
-- copia de las vigentes al enviarla (o aprobarla): si después cambian, la
-- cotización sigue mostrando lo que recibió el cliente. Los borradores usan
-- siempre las vigentes.

-- Ajustes generales de la app (una fila por ajuste; el valor en JSON).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings for select to authenticated using (true);
drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Las condiciones de hoy (documento "Terminos_y_Condiciones_Ebony").
insert into public.app_settings (key, value) values ('quote_terms', '{"title": "Condiciones Generales – Ebony | Custom Woodwork", "intro": "Al realizar el abono inicial, el cliente declara haber leído, entendido y aceptado en su totalidad los presentes términos y condiciones.", "sections": [{"title": "1. Diseño y Desarrollo", "items": ["El proyecto inicia tras la aprobación formal de la cotización y el abono inicial.", "Incluye reuniones, visitas técnicas (cuando aplique), y la elaboración de planos constructivos.", "El cliente podrá solicitar hasta **dos (2) rondas de cambios** sin costo adicional. Cambios adicionales tendrán un cargo según complejidad.", "La aprobación escrita de planos (por correo o firma) representa la autorización para iniciar producción. No se aceptan cambios posteriores sin impacto en costos y tiempos.", "Antes de proceder a producción, **se rectificarán las medidas en sitio**. La cotización puede **variar** en función de estos ajustes o del diseño final.", "En caso de que el cliente desee **eliminar un ítem ya abonado**, se podrá aplicar un cargo por **costos ya incurridos en diseño, planificación o medición técnica.**", "En caso de que el cliente decida reducir el alcance del proyecto una vez iniciado, la cotización será revisada en función del nuevo volumen. En caso de haberse aplicado un descuento basado en el volumen original, dicho descuento podrá ser ajustado o eliminado conforme al nuevo alcance, y el proyecto será recotizado según las condiciones vigentes para el nuevo volumen."]}, {"title": "2. Producción y Ejecución", "items": ["El plazo de producción y entrega comenzará a contarse únicamente a partir de la aprobación escrita de los planos constructivos finales por parte del cliente.", "Los materiales y acabados se fabrican conforme a lo aprobado. Cambios posteriores se cotizarán por separado y pueden afectar los tiempos de entrega.", "Durante el desarrollo del proyecto pueden surgir **modificaciones o solicitudes adicionales (\"extras\")**. Estos serán cotizados y deberán ser **pagados al 100%** antes de su ejecución.", "Ebony se reserva el derecho de realizar ajustes técnicos que no alteren la estética ni funcionalidad del diseño.", "Materiales como la chapilla pueden presentar diferencias de tono y vetas propias de su naturaleza. Estas variaciones no se consideran defectos, sino características inherentes del material.", "No nos hacemos responsables por **desniveles, desplomes de paredes, techos o pisos**, que puedan afectar la instalación y por ende el resultado final de la entrega.", "En proyectos de ejecución extendida, los precios cotizados aplican para los ítems cuya producción inicie dentro de un plazo razonable desde la aprobación. En caso de que incrementos documentados en los costos de materia prima por parte de nuestros proveedores afecten ítems aún no iniciados en producción, Ebony se reserva el derecho de trasladar dicho ajuste al cliente. El incremento será notificado con anticipación y respaldado con documentación del proveedor."]}, {"title": "3. Entrega e Instalación", "items": ["La instalación debe ser coordinada con antelación. El sitio debe contar con **electricidad funcional** para operar.", "El **acceso al área de trabajo debe estar completamente despejado** al momento de la instalación.", "**Ebony no realiza desmontaje de mobiliario existente**, salvo que haya sido expresamente cotizado. De requerirse despejar el área o desinstalar elementos existentes, se generará un **cargo adicional**.", "Todo trabajo **previo a nuestra llegada** debe estar completado (remoción de zócalos, refuerzos estructurales, extensiones eléctricas, etc.). De no estarlo, se pueden generar **costos adicionales** y retrasos.", "Si no se permite el ingreso al sitio en la fecha pactada (por falta de reserva de ascensor, acceso bloqueado o falta de coordinación), se aplicará un cargo de **$150** por costos logísticos.", "El cliente deberá informar con anticipación sobre la existencia de tuberías, cañerías u otras instalaciones ocultas en las paredes, pisos o techos del área de instalación. En caso de producirse una perforación accidental durante los trabajos de instalación por falta de esta información, la reparación correrá por cuenta del cliente.", "Los trabajos de carpintería e instalación son de naturaleza intrusiva. A pesar de las medidas de protección que Ebony implementa, no nos hacemos responsables por roces, manchas, polvo o daños menores a pintura, pasteo u otras superficies aledañas al área de trabajo. De requerirse retoque de pintura u otros acabados post-instalación, este costo no está incluido salvo que se haya cotizado expresamente.", "Ebony incluye el traslado del mobiliario hasta el área de instalación. En caso de que las dimensiones de las piezas excedan la capacidad del ascensor y se requiera el uso de grúa, escaleras u otros medios alternativos, el costo de dichos servicios correrá por cuenta del cliente.", {"text": "Ebony **no realiza** trabajos de:", "sub": ["**Plomería:** movimiento de tuberías o instalaciones hidráulicas.", "**Electricidad:** cableado, reubicación de tomacorrientes o salidas especiales.", "**Albañilería:** pintura, pasteo, modificaciones de paredes, techos o zócalos.", "**Superficies:** no incluye sobres de piedra, granito u otros, salvo que se especifique.", "**Herrajes y tiradores:** sólo se incluyen si están claramente descritos en la cotización."]}, "**Todo lo que no esté explícitamente detallado en la cotización, no está incluido.**"]}, {"title": "4. Garantía", "items": ["Cualquier reclamo por garantía será evaluado según nuestro **manual de cuidado y mantenimiento**, el cual se entrega al finalizar el proyecto."]}, {"title": "5. Condiciones de Pago", "items": ["**50% al aceptar la cotización**, un **40% previo a la entrada a sitio**, y el **10% restante al finalizar la instalación.**", "Pagos fuera de término pueden generar recargos y afectar el cronograma del proyecto."]}]}'::jsonb)
on conflict (key) do nothing;

alter table public.quotes add column if not exists terms jsonb;

create or replace function private.current_quote_terms()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select value from public.app_settings where key = 'quote_terms' $$;

create or replace function private.close_opportunity_quotes(p_opportunity uuid, p_approved uuid[], p_project uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('ebony.quote_status', true), '');
  v_today date := private.panama_today();
begin
  perform set_config('ebony.quote_status', '1', true);
  update public.quotes
     set status = 'APROBADA', project_id = coalesce(p_project, project_id), sent_on = coalesce(sent_on, v_today),
         terms = coalesce(terms, private.current_quote_terms()),
         closed_on = v_today, follow_up_on = null
   where opportunity_id = p_opportunity and id = any (coalesce(p_approved, '{}')) and status in ('BORRADOR', 'ENVIADA');
  update public.quotes
     set status = 'RECHAZADA', closed_on = v_today, follow_up_on = null
   where opportunity_id = p_opportunity and not (id = any (coalesce(p_approved, '{}'))) and status in ('BORRADOR', 'ENVIADA');
  perform set_config('ebony.quote_status', v_prev, true);
end;
$$;

create or replace function public.set_quote_status(
  p_id uuid,
  p_status text,
  p_lost_reason text default null,
  p_lost_note text default null,
  p_project_name text default null,
  p_project_id uuid default null,
  p_also uuid[] default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  q public.quotes;
  v_today date := private.panama_today();
  v_project uuid;
  v_open_siblings int;
begin
  if not private.has_module('cotizacion') then raise exception 'Sin permiso de Cotización.'; end if;
  select * into q from public.quotes where id = p_id for update;
  if not found then raise exception 'COTIZACION_NO_EXISTE'; end if;
  if q.status = p_status then return q.project_id; end if;
  perform set_config('ebony.quote_status', '1', true);

  if p_status = 'BORRADOR' then
    if q.status <> 'ENVIADA' then raise exception 'Solo una cotización enviada vuelve a borrador.'; end if;
    if not private.is_admin() then raise exception 'Solo el admin puede volver una cotización a borrador.'; end if;
    update public.quotes set status = 'BORRADOR', sent_on = null, follow_up_on = null, terms = null where id = p_id;

  elsif p_status = 'ENVIADA' then
    if q.status <> 'BORRADOR' then raise exception 'Solo un borrador se envía.'; end if;
    update public.quotes set status = 'ENVIADA', sent_on = v_today, follow_up_on = v_today + 7, terms = private.current_quote_terms() where id = p_id;

  elsif p_status = 'APROBADA' then
    if q.status not in ('BORRADOR', 'ENVIADA') then raise exception 'Esta cotización ya está cerrada.'; end if;
    if q.opportunity_id is not null then
      -- Aprueba la oportunidad con esta y las marcadas; las demás abiertas se rechazan.
      v_project := public.approve_opportunity(q.opportunity_id, p_project_name, p_project_id, array[p_id] || coalesce(p_also, '{}'));
    else
      v_project := q.project_id;
      update public.quotes set status = 'APROBADA', sent_on = coalesce(sent_on, v_today), closed_on = v_today, follow_up_on = null,
             terms = coalesce(terms, private.current_quote_terms())
       where id = p_id;
    end if;

  elsif p_status = 'RECHAZADA' then
    if q.status not in ('BORRADOR', 'ENVIADA') then raise exception 'Esta cotización ya está cerrada.'; end if;
    update public.quotes set status = 'RECHAZADA', closed_on = v_today, follow_up_on = null where id = p_id;
    if q.opportunity_id is not null then
      select count(*) into v_open_siblings from public.quotes
       where opportunity_id = q.opportunity_id and status in ('BORRADOR', 'ENVIADA');
      if v_open_siblings = 0 then
        if p_lost_reason is null then raise exception 'MOTIVO_REQUERIDO'; end if;
        update public.sales_opportunities set stage = 'perdida', lost_reason = p_lost_reason, lost_note = nullif(btrim(p_lost_note), '')
         where id = q.opportunity_id and stage not in ('aprobada', 'perdida');
      end if;
    end if;

  else
    raise exception 'Estado no válido: %', p_status;
  end if;

  perform set_config('ebony.quote_status', '', true);
  return v_project;
end;
$$;
revoke all on function public.set_quote_status(uuid, text, text, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.set_quote_status(uuid, text, text, text, text, uuid, uuid[]) to authenticated;

-- Las ya enviadas, aprobadas o rechazadas se quedan con las de hoy.
update public.quotes set terms = private.current_quote_terms() where status <> 'BORRADOR' and terms is null;
