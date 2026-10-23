-- Cotizador · lectura de planos — permisos por módulo
--
-- La migración de planos (20261024110000_fase1_cotizador_planos.sql) se
-- escribió antes de los permisos por módulo (20261020120000_usuarios_permisos.sql)
-- y deja entrar a quote_plans a cualquier usuario de la app. Acá se alinea
-- con el resto del cotizador: pide el módulo `cotizacion` (el admin siempre).
--
-- Las policies del bucket "planos" en storage.objects no se pueden alterar
-- desde acá (su dueño es Storage); siguen permitiendo a cualquier usuario
-- de la app, y la app solo ofrece subir planos dentro del cotizador.

alter policy "quote_plans_app_users_all" on public.quote_plans
  using (private.has_module('cotizacion'))
  with check (private.has_module('cotizacion'));

alter policy "quote_plans_app_users_all" on public.quote_plans rename to "quote_plans_module_all";
