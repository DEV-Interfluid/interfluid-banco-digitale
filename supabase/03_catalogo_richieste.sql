-- =====================================================================================
-- Vetrina · v2 · 12/11/2026 · catalogo per cliente e richieste d'ordine
-- Decisioni G. Sala 12/11/2026: il Banco digitale diventa lo strumento per i clienti fidelizzati
-- (Hydroservice, Faro Oleodinamica, Parmafluid); il cruscotto calcola, la vetrina mostra.
--
-- catalogo  · scritto SOLO dalla sincronizzazione notturna n8n (funzione banco_export del cruscotto,
--             chiave di servizio di questo progetto conservata solo in n8n). Il cliente legge solo le sue righe.
--             Mai costi, margini, tier o codici gestionali.
-- richieste · il cliente invia una richiesta d'ordine con la funzione invia_richiesta(): i prezzi
--             vengono SEMPRE riletti dal catalogo, mai presi dal browser. Il commerciale la conferma.
-- =====================================================================================

begin;

create table public.catalogo (
  cliente        text not null references public.clienti(codice),
  codice         text not null,
  descrizione    text,
  brand          text not null,
  serie          text,
  prezzo_netto   numeric(12,2) check (prezzo_netto is null or prezzo_netto > 0),   -- null = prezzo su richiesta
  modalita       text not null default 'stock' check (modalita in ('stock', 'su_ordine')),
  disponibile    numeric,                                                        -- null = quantità non mostrata
  disponibilita  text check (disponibilita in ('disponibile', 'da_ordinare')),
  esaurimento    boolean not null default false,
  accordo        boolean not null default false,
  data_prezzi    date,
  aggiornato_il  timestamptz not null default now(),
  primary key (cliente, codice)
);

create table public.sincronizzazioni (
  cliente      text primary key references public.clienti(codice),
  righe        int not null,
  eseguita_il  timestamptz not null default now()
);

create table public.richieste (
  id           bigint generated always as identity primary key,
  cliente      text not null references public.clienti(codice),
  user_id      uuid not null,
  riferimento  text check (length(riferimento) <= 120),
  note         text check (length(note) <= 2000),
  totale       numeric(12,2),
  stato        text not null default 'inviata' check (stato in ('inviata', 'confermata', 'annullata')),
  creata_il    timestamptz not null default now()
);

create table public.richieste_righe (
  richiesta_id  bigint not null references public.richieste(id) on delete cascade,
  riga          int not null,
  codice        text not null,
  qta           numeric(12,2) not null check (qta > 0),
  prezzo_netto  numeric(12,2),                                                   -- null = da quotare
  primary key (richiesta_id, riga)
);

alter table public.catalogo         enable row level security;
alter table public.sincronizzazioni enable row level security;
alter table public.richieste        enable row level security;
alter table public.richieste_righe  enable row level security;

revoke all on public.catalogo, public.sincronizzazioni, public.richieste, public.richieste_righe from anon, authenticated;
grant select on public.catalogo, public.sincronizzazioni, public.richieste, public.richieste_righe to authenticated;

create policy catalogo_proprio on public.catalogo
  for select to authenticated using (cliente = public.mio_cliente());
create policy sincronizzazioni_proprie on public.sincronizzazioni
  for select to authenticated using (cliente = public.mio_cliente());
create policy richieste_proprie on public.richieste
  for select to authenticated using (cliente = public.mio_cliente());
create policy richieste_righe_proprie on public.richieste_righe
  for select to authenticated using (
    exists (select 1 from public.richieste r where r.id = richiesta_id and r.cliente = public.mio_cliente()));

-- invio di una richiesta d'ordine: righe = [{"codice": "...", "qta": 2}, ...]
create or replace function public.invia_richiesta(p_righe jsonb, p_riferimento text default null, p_note text default null)
returns bigint
language plpgsql volatile security definer
set search_path = public
as $$
declare cli text := public.mio_cliente(); rid bigint; r jsonb; n int := 0; q numeric; c record;
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
    n := n + 1;
    insert into public.richieste_righe (richiesta_id, riga, codice, qta, prezzo_netto)
    values (rid, n, coalesce(c.codice, left(trim(r->>'codice'), 80)), q, c.prezzo_netto);
  end loop;
  if n = 0 then raise exception 'Nessuna riga valida'; end if;
  update public.richieste set totale = (select sum(qta * prezzo_netto) from public.richieste_righe where richiesta_id = rid) where id = rid;
  return rid;
end $$;
revoke all on function public.invia_richiesta(jsonb, text, text) from public, anon;
grant execute on function public.invia_richiesta(jsonb, text, text) to authenticated;

alter table public.accessi drop constraint if exists accessi_azione_check;
alter table public.accessi add constraint accessi_azione_check
  check (azione in ('accesso', 'listino', 'calcolo', 'scarica_excel', 'ricerca', 'richiesta'));

insert into public.clienti (codice, ragione_sociale) values ('009073', 'Parmafluid S.r.l.') on conflict do nothing;

commit;
