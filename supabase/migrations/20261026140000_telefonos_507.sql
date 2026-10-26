-- Teléfonos de proveedores en un solo formato: "+507 6000-0000" para Panamá;
-- los de otro país (+86, +57…) quedan como vienen, sin caracteres invisibles.
-- La app aplica la misma regla al guardar (formatPhonePA).
-- Además, contactos de Dimosa y FDC (26-oct-2026).

create or replace function private.format_phone_pa(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p is null or btrim(p) = '' then null
    when regexp_replace(p, '\D', '', 'g') ~ '^[0-9]{8}$'
      then '+507 ' || substr(regexp_replace(p, '\D', '', 'g'), 1, 4) || '-' || substr(regexp_replace(p, '\D', '', 'g'), 5, 4)
    when regexp_replace(p, '\D', '', 'g') ~ '^507[0-9]{8}$'
      then '+507 ' || substr(regexp_replace(p, '\D', '', 'g'), 4, 4) || '-' || substr(regexp_replace(p, '\D', '', 'g'), 8, 4)
    else btrim(regexp_replace(p, '[‪‬‎‏]', '', 'g'))
  end;
$$;

update public.suppliers
   set contacts = '[{"name":"Monica","role":"Gerente","whatsapp":"63211366"},{"name":"","role":"Ventas","whatsapp":"62484385"}]'::jsonb
 where name = 'Dimosa';
update public.suppliers
   set contacts = '[{"name":"Sara Castillo","role":"Vendedora","whatsapp":"68238406"},{"name":"Neftali Castillo","role":"Gerente de ventas","whatsapp":"63171332"}]'::jsonb
 where name = 'FDC';

update public.suppliers s
   set contacts = coalesce((
         select jsonb_agg(jsonb_set(c, '{whatsapp}', to_jsonb(coalesce(private.format_phone_pa(c->>'whatsapp'), ''))) order by o)
           from jsonb_array_elements(s.contacts) with ordinality as t(c, o)), '[]'::jsonb),
       phone = private.format_phone_pa(phone);
update public.suppliers
   set whatsapp = nullif(contacts->0->>'whatsapp', ''),
       contact_name = nullif(contacts->0->>'name', '')
 where jsonb_array_length(contacts) > 0;
