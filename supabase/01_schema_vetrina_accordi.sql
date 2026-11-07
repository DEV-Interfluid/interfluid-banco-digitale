-- =====================================================================================
-- Vetrina accordi clienti · v1 · 07/11/2026
-- Progetto Supabase SEPARATO dal cruscotto (decisione G. Sala, 07/11/2026).
-- Contiene solo ciò che i clienti possono vedere: listino dell'accordo, disponibilità,
-- fatturato aggregato e regola del bonus. Nessun costo, margine, tier o dato di altri clienti.
--
-- Chi scrive: solo il flusso di sincronizzazione (n8n, con la chiave di servizio di QUESTO
-- progetto, conservata solo in n8n). I clienti leggono e basta, e solo le proprie righe.
-- Prima di usarlo: Authentication › Sign In / Providers › "Allow new users to sign up" = OFF.
-- I clienti entrano solo su invito (Authentication › Users › Invite user).
-- =====================================================================================

begin;

-- ---------- tabelle ------------------------------------------------------------------

create table public.clienti (
  codice          text primary key,                 -- codice cliente Mago (es. 001684)
  ragione_sociale text not null
);

create table public.utenti_clienti (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  cliente   text not null references public.clienti(codice),
  nome      text,
  attivo    boolean not null default true,          -- false = accesso revocato senza cancellare l'utente
  creato_il timestamptz not null default now()
);

create table public.accordi (
  id            bigint generated always as identity primary key,
  cliente       text not null references public.clienti(codice),
  brand         text not null,                      -- es. MARZOCCHI
  anno          int  not null,
  valido_dal    date not null,
  valido_al     date not null,
  soglia_bonus  numeric(12,2) not null,             -- es. 50000
  bonus_pct     numeric(5,2)  not null,             -- es. 5
  note          text,
  unique (cliente, brand, anno)
);

create table public.listino (
  accordo_id      bigint not null references public.accordi(id) on delete cascade,
  codice          text not null,                    -- codice commerciale Marzocchi (mai il codice gestionale)
  serie           text,
  prezzo_netto    numeric(12,2) not null check (prezzo_netto > 0),
  a_magazzino     boolean not null default false,
  disponibilita_al date,
  primary key (accordo_id, codice)
);

create table public.fatturato (
  accordo_id    bigint primary key references public.accordi(id) on delete cascade,
  importo_netto numeric(12,2) not null default 0,   -- fatture meno note di credito dell'anno
  aggiornato_al date not null
);

create table public.accessi (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid(),
  quando   timestamptz not null default now(),
  azione   text not null check (azione in ('accesso','listino','calcolo','scarica_excel'))
);

-- ---------- chi è il cliente dell'utente collegato ------------------------------------

create or replace function public.mio_cliente()
returns text
language sql stable security definer
set search_path = public
as $$
  select cliente from public.utenti_clienti where user_id = auth.uid() and attivo
$$;

revoke all on function public.mio_cliente() from public, anon;
grant execute on function public.mio_cliente() to authenticated;

-- ---------- permessi: tutto chiuso, poi si apre solo la lettura delle proprie righe -----

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon;

alter table public.clienti        enable row level security;
alter table public.utenti_clienti enable row level security;
alter table public.accordi        enable row level security;
alter table public.listino        enable row level security;
alter table public.fatturato      enable row level security;
alter table public.accessi        enable row level security;

grant select on public.clienti, public.utenti_clienti, public.accordi, public.listino, public.fatturato
  to authenticated;
grant insert on public.accessi to authenticated;

create policy clienti_propri on public.clienti
  for select to authenticated using (codice = public.mio_cliente());

create policy utente_proprio on public.utenti_clienti
  for select to authenticated using (user_id = auth.uid());

create policy accordi_propri on public.accordi
  for select to authenticated using (cliente = public.mio_cliente());

create policy listino_proprio on public.listino
  for select to authenticated using (
    exists (select 1 from public.accordi a where a.id = accordo_id and a.cliente = public.mio_cliente()));

create policy fatturato_proprio on public.fatturato
  for select to authenticated using (
    exists (select 1 from public.accordi a where a.id = accordo_id and a.cliente = public.mio_cliente()));

create policy accessi_propri on public.accessi
  for insert to authenticated with check (user_id = auth.uid() and public.mio_cliente() is not null);

commit;
