-- Compras: quien tiene Almacén ve todas las solicitudes y su estado (para
-- saber si lo que espera ya se pidió). Sin Almacén, cada quien ve solo las
-- suyas. Los costos viven en otra tabla y siguen siendo de Compras/Costos.

drop policy if exists "purchase_requests_read" on public.purchase_requests;
create policy "purchase_requests_read" on public.purchase_requests for select to authenticated
  using (private.has_module('almacen') or private.has_module('almacen_compras') or created_by = (select auth.uid()));
