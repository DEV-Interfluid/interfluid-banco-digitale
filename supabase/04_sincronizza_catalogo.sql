-- =====================================================================================
-- Vetrina · v3 · 12/11/2026 · funzione di sincronizzazione del catalogo
-- Chiamata SOLO dal flusso n8n "Banco Digitale · sincronizzazione" con la chiave di servizio della vetrina.
-- Riceve il catalogo di un cliente prodotto dal cruscotto (banco_export_json) e sostituisce in un'unica
-- transazione le righe di quel cliente. Un catalogo vuoto non cancella nulla: errore e catalogo precedente intatto.
-- Accetta solo i campi visibili al cliente: qualunque altro campo nel JSON viene ignorato.
-- =====================================================================================

create or replace function public.sincronizza_catalogo(p_cliente text, p_righe jsonb, p_data_prezzi date default null)
returns int
language plpgsql volatile security definer
set search_path = public
as $$
declare n int;
begin
  if not exists (select 1 from public.clienti where codice = p_cliente) then
    raise exception 'Cliente % non presente nella vetrina', p_cliente;
  end if;
  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then
    raise exception 'Catalogo vuoto per %: nessuna modifica', p_cliente;
  end if;

  delete from public.catalogo where cliente = p_cliente;
  insert into public.catalogo (cliente, codice, descrizione, brand, serie, prezzo_netto, modalita,
                               disponibile, disponibilita, esaurimento, accordo, data_prezzi, aggiornato_il)
  select p_cliente, r->>'codice', nullif(r->>'descrizione', ''), r->>'brand', nullif(r->>'serie', ''),
         nullif(r->>'prezzo_netto', '')::numeric(12,2), coalesce(r->>'modalita', 'stock'),
         nullif(r->>'disponibile', '')::numeric, r->>'disponibilita',
         coalesce((r->>'esaurimento')::boolean, false), coalesce((r->>'accordo')::boolean, false),
         p_data_prezzi, now()
  from jsonb_array_elements(p_righe) r
  where coalesce(r->>'codice', '') <> ''
  on conflict (cliente, codice) do nothing;
  get diagnostics n = row_count;

  insert into public.sincronizzazioni (cliente, righe, eseguita_il) values (p_cliente, n, now())
  on conflict (cliente) do update set righe = excluded.righe, eseguita_il = excluded.eseguita_il;
  return n;
end $$;

revoke all on function public.sincronizza_catalogo(text, jsonb, date) from public, anon, authenticated;
grant execute on function public.sincronizza_catalogo(text, jsonb, date) to service_role;

