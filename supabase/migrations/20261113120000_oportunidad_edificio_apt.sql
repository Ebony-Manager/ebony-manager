-- Oportunidades: la ubicación se separa. `location` pasa a ser el barrio; el edificio (o casa) y el
-- apartamento (solo número y letra, "19C") van en columnas propias. El nombre del proyecto se arma
-- "firma o cliente – edificio Apt número" (el "Apt" lo pone la app).
alter table public.sales_opportunities
  add column if not exists building text,
  add column if not exists unit text;

comment on column public.sales_opportunities.location is 'Barrio o zona (no entra en el nombre del proyecto).';
comment on column public.sales_opportunities.building is 'Edificio o casa ("Ph Aquapoint", "Casa 76").';
comment on column public.sales_opportunities.unit is 'Apartamento: solo número o número y letra ("19C"); la app antepone "Apt".';
