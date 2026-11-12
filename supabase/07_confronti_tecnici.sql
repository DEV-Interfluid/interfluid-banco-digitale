-- =====================================================================================
-- Vetrina · v6 · 12/11/2026 · confronti tecnici (pompe a ingranaggi interni)
-- Decisione G. Sala 12/11/2026: per le pompe il cliente vede il confronto tecnico tra la sua pompa (Rexroth, Eckerle,
-- Voith) e l'alternativa Hydraut: verdetto del comparatore, dati affiancati, adattamenti. Solo coppie validate.
-- catalogo.confronti · dal cruscotto (banco_confronti_codice): solo dati tecnici, mai costi o note interne.
-- =====================================================================================

alter table public.catalogo add column if not exists confronti jsonb not null default '[]'::jsonb;

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
                               disponibile, disponibilita, esaurimento, accordo, data_prezzi, chiavi, confronti, aggiornato_il)
  select p_cliente, r->>'codice', nullif(r->>'descrizione', ''), r->>'brand', nullif(r->>'serie', ''),
         nullif(r->>'prezzo_netto', '')::numeric(12,2), coalesce(r->>'modalita', 'stock'),
         nullif(r->>'disponibile', '')::numeric, r->>'disponibilita',
         coalesce((r->>'esaurimento')::boolean, false), coalesce((r->>'accordo')::boolean, false),
         p_data_prezzi,
         coalesce((select array_agg(k) from jsonb_array_elements_text(case when jsonb_typeof(r->'chiavi') = 'array' then r->'chiavi' else '[]'::jsonb end) k
                    where k ~ '^[RT]:[A-Z0-9]{3,60}$'), '{}'),
         case when jsonb_typeof(r->'confronti') = 'array' then r->'confronti' else '[]'::jsonb end,
         now()
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
