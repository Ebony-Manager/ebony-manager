-- Cotizador: el descuento general en % se escribe en la casilla de descuento de cada ítem (decisión de Carlos, 20 nov).
-- El cálculo sale solo de la casilla de cada ítem; el general en % sirve para llenarlas (los cambiados a mano se
-- respetan) y el general en monto se resta al final. Para que ninguna cotización cambie sus números, los ítems sin
-- descuento propio de las cotizaciones con descuento general en % reciben ese % en su casilla (es lo que ya heredaban).
alter table public.quote_sections disable trigger quote_sections_locked_guard;
update public.quote_sections s
   set discount_type = 'pct',
       discount_value = q.discount_value
  from public.quotes q
 where q.id = s.quote_id
   and q.discount_type = 'pct'
   and q.discount_value > 0
   and s.discount_value = 0;
alter table public.quote_sections enable trigger quote_sections_locked_guard;
