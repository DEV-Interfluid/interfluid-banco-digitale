-- =====================================================================================
-- Vetrina · v5 · 12/11/2026 · riconoscimento dei codici incollati e alternative
-- Decisione G. Sala 12/11/2026: il cliente incolla liste anche con codici di altri costruttori (numeri R e
-- sigle Rexroth); il Banco li riconosce e propone gli equivalenti HUADE/Hydraut del suo catalogo.
-- catalogo.chiavi   · numeri R (R:) e sigle normalizzate (T:) degli equivalenti, dal cruscotto (banco_export_json).
--                     Solo codici: nessun costo o margine.
-- richieste_righe.richiesto · il codice come l'ha scritto il cliente, per il commerciale.
-- =====================================================================================

alter table public.catalogo add column if not exists chiavi text[] not null default '{}';
alter table public.richieste_righe add column if not exists richiesto text check (length(richiesto) <= 200);

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
                               disponibile, disponibilita, esaurimento, accordo, data_prezzi, chiavi, aggiornato_il)
  select p_cliente, r->>'codice', nullif(r->>'descrizione', ''), r->>'brand', nullif(r->>'serie', ''),
         nullif(r->>'prezzo_netto', '')::numeric(12,2), coalesce(r->>'modalita', 'stock'),
         nullif(r->>'disponibile', '')::numeric, r->>'disponibilita',
         coalesce((r->>'esaurimento')::boolean, false), coalesce((r->>'accordo')::boolean, false),
         p_data_prezzi,
         coalesce((select array_agg(k) from jsonb_array_elements_text(case when jsonb_typeof(r->'chiavi') = 'array' then r->'chiavi' else '[]'::jsonb end) k
                    where k ~ '^[RT]:[A-Z0-9]{3,60}$'), '{}'),
         now()
  from jsonb_array_elements(p_righe) r
  where coalesce(r->>'codice', '') <> ''
  on conflict (cliente, codice) do nothing;
  get diagnostics n = row_count;

  insert into public.sincronizzazioni (cliente, righe, eseguita_il) values (p_cliente, n, now())
  on conflict (cliente) do update set righe = excluded.righe, eseguita_il = excluded.eseguita_il;
  return n;
end $$;

-- invio di una richiesta d'ordine: righe = [{"codice": "...", "qta": 2, "richiesto": "R900561288 4WE 6 J6X/EG24N9K4"}, ...]
create or replace function public.invia_richiesta(p_righe jsonb, p_riferimento text default null, p_note text default null)
returns bigint
language plpgsql volatile security definer
set search_path = public
as $$
declare cli text := public.mio_cliente(); rid bigint; r jsonb; n int := 0; q numeric; c record; ric text;
begin
  if cli is null then raise exception 'Accesso non abilitato'; end if;
  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then raise exception 'Richiesta vuota'; end if;
  if jsonb_array_length(p_righe) > 200 then raise exception 'Massimo 200 righe per richiesta'; end if;
  insert into public.richieste (cliente, user_id, riferimento, note)
  values (cli, auth.uid(), left(nullif(trim(p_riferimento), ''), 120), left(nullif(trim(p_note), ''), 2000))
  returning id into rid;
  for r in select * from jsonb_array_elements(p_righe) loop
    q := (r->>'qta')::numeric;
    if q is null or q <= 0 then continue; end if;
    c := null;
    select k.codice, k.prezzo_netto into c from public.catalogo k
     where k.cliente = cli and upper(k.codice) = upper(trim(r->>'codice'));
    ric := left(nullif(trim(r->>'richiesto'), ''), 200);
    if ric is not null and c.codice is not null and upper(regexp_replace(ric, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(c.codice, '[^A-Za-z0-9]', '', 'g')) then ric := null; end if;
    n := n + 1;
    insert into public.richieste_righe (richiesta_id, riga, codice, qta, prezzo_netto, richiesto)
    values (rid, n, coalesce(c.codice, left(trim(r->>'codice'), 80)), q, c.prezzo_netto, ric);
  end loop;
  if n = 0 then raise exception 'Nessuna riga valida'; end if;
  update public.richieste set totale = (select sum(qta * prezzo_netto) from public.richieste_righe where richiesta_id = rid) where id = rid;
  return rid;
end $$;

create or replace function public.richieste_da_notificare()
returns setof jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id, 'cliente', r.cliente, 'ragione_sociale', c.ragione_sociale,
    'utente_nome', u.nome, 'utente_email', a.email::text,
    'riferimento', r.riferimento, 'note', r.note, 'totale', r.totale, 'creata_il', r.creata_il,
    'righe', (select jsonb_agg(jsonb_build_object(
                'riga', rr.riga, 'codice', rr.codice, 'qta', rr.qta, 'prezzo_netto', rr.prezzo_netto, 'richiesto', rr.richiesto,
                'descrizione', k.descrizione, 'disponibilita', k.disponibilita, 'disponibile', k.disponibile)
              order by rr.riga)
              from public.richieste_righe rr
              left join public.catalogo k on k.cliente = r.cliente and k.codice = rr.codice
              where rr.richiesta_id = r.id))
  from public.richieste r
  join public.clienti c on c.codice = r.cliente
  left join public.utenti_clienti u on u.user_id = r.user_id
  left join auth.users a on a.id = r.user_id
  where r.notificata_il is null and r.stato = 'inviata'
  order by r.id
  limit 20
$$;

revoke all on function public.sincronizza_catalogo(text, jsonb, date) from public, anon, authenticated;
grant execute on function public.sincronizza_catalogo(text, jsonb, date) to service_role;
revoke all on function public.invia_richiesta(jsonb, text, text) from public, anon;
grant execute on function public.invia_richiesta(jsonb, text, text) to authenticated;
revoke all on function public.richieste_da_notificare() from public, anon, authenticated;
grant execute on function public.richieste_da_notificare() to service_role;
