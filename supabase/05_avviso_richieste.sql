-- =====================================================================================
-- Vetrina · v4 · 12/11/2026 · avviso al commerciale per ogni nuova richiesta d'ordine
-- Decisione G. Sala 12/11/2026: email al commerciale (owner HubSpot del cliente) e compito su HubSpot.
-- Usate SOLO dal flusso n8n "Banco Digitale · avviso richieste" con la chiave segreta della vetrina.
-- =====================================================================================

alter table public.richieste add column if not exists notificata_il timestamptz;
alter table public.richieste add column if not exists hubspot_task_id text;

-- Richieste non ancora notificate, con cliente, utente e righe (descrizione presa dal catalogo).
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
                'riga', rr.riga, 'codice', rr.codice, 'qta', rr.qta, 'prezzo_netto', rr.prezzo_netto,
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

create or replace function public.segna_richiesta_notificata(p_id bigint, p_hubspot_task_id text default null)
returns void
language sql volatile security definer
set search_path = public
as $$
  update public.richieste set notificata_il = now(), hubspot_task_id = nullif(p_hubspot_task_id, '')
  where id = p_id;
$$;

revoke all on function public.richieste_da_notificare() from public, anon, authenticated;
revoke all on function public.segna_richiesta_notificata(bigint, text) from public, anon, authenticated;
grant execute on function public.richieste_da_notificare() to service_role;
grant execute on function public.segna_richiesta_notificata(bigint, text) to service_role;
