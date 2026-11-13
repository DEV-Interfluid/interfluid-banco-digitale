-- =====================================================================================
-- Vetrina · v7 · 13/11/2026 · simulazione dei clienti per gli utenti Interfluid
-- Decisione G. Sala 13/11/2026: con la propria email un utente Interfluid può vedere il Banco come lo vede ciascun
-- cliente (Parmafluid, Hydroservice, Faro) e passare dall'uno all'altro, per prove e simulazioni.
-- Le regole del database non cambiano: mio_cliente() resta l'unica chiave e vale per un cliente alla volta.
-- simulazioni      · quali clienti un utente può simulare. Si scrive solo dal pannello di Supabase.
-- cambia_cliente() · sposta l'utente su un cliente della sua lista (solo indirizzi @interfluid.net).
-- Le richieste di prova degli utenti che simulano non compaiono ai clienti veri.
-- =====================================================================================

create table if not exists public.simulazioni (
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente text not null references public.clienti(codice),
  primary key (user_id, cliente)
);
alter table public.simulazioni enable row level security;
revoke all on public.simulazioni from anon, authenticated;

-- l'elenco dei clienti tra cui scegliere (solo codice e ragione sociale)
create or replace function public.clienti_simulabili()
returns table (codice text, ragione_sociale text)
language sql stable security definer
set search_path = public
as $$
  select c.codice, c.ragione_sociale
  from public.simulazioni s join public.clienti c on c.codice = s.cliente
  join auth.users u on u.id = s.user_id
  where s.user_id = auth.uid() and lower(u.email) like '%@interfluid.net'
  order by c.ragione_sociale
$$;

create or replace function public.cambia_cliente(p_cliente text)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.simulazioni s join auth.users u on u.id = s.user_id
                 where s.user_id = auth.uid() and s.cliente = p_cliente and lower(u.email) like '%@interfluid.net') then
    raise exception 'Cliente non disponibile';
  end if;
  update public.utenti_clienti set cliente = p_cliente where user_id = auth.uid() and attivo;
  if not found then raise exception 'Accesso non abilitato'; end if;
  return p_cliente;
end $$;

revoke all on function public.clienti_simulabili() from public, anon;
grant execute on function public.clienti_simulabili() to authenticated;
revoke all on function public.cambia_cliente(text) from public, anon;
grant execute on function public.cambia_cliente(text) to authenticated;

-- le richieste di prova (di chi simula) le vede solo chi le ha fatte
create or replace function public.utente_simula(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.simulazioni where user_id = p_user) $$;
revoke all on function public.utente_simula(uuid) from public, anon;
grant execute on function public.utente_simula(uuid) to authenticated;

drop policy if exists richieste_proprie on public.richieste;
create policy richieste_proprie on public.richieste for select to authenticated
  using (cliente = public.mio_cliente() and (user_id = auth.uid() or not public.utente_simula(user_id)));

drop policy if exists richieste_righe_proprie on public.richieste_righe;
create policy richieste_righe_proprie on public.richieste_righe for select to authenticated
  using (exists (select 1 from public.richieste r where r.id = richieste_righe.richiesta_id));

-- abilitazione iniziale: G. Sala può simulare tutti i clienti
insert into public.simulazioni (user_id, cliente)
select u.id, c.codice from auth.users u cross join public.clienti c
where lower(u.email) = 'g.sala@interfluid.net'
on conflict do nothing;
