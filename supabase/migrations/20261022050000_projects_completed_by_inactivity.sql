-- Proyectos viejos → "Terminado". Ninguno tenía estado puesto (los 97
-- estaban ACTIVE). Se terminan los que no tienen movimientos de
-- contratistas en los últimos 60 días; no se borra nada y cualquiera se
-- puede reabrir desde su ficha.
update public.projects p
set status = 'COMPLETED', updated_at = now()
where p.status = 'ACTIVE'
  and not exists (
    select 1 from public.contractor_ledger_entries e
    where e.project_id = p.id and e.entry_date >= current_date - 60
  );
