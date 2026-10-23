-- Contratos: se quitan "Alcance / qué incluye" y "Acuerdo de pago". No se
-- usaban (ninguno estaba lleno) y ya no están en la pantalla. Queda Notas.
alter table public.contractor_contracts drop column if exists scope;
alter table public.contractor_contracts drop column if exists payment_terms;
