# Banco Digitale Interfluid

Area riservata ai clienti con accordo quadro. Vedi CLAUDE.md per regole e architettura.

## Messa in opera (una volta sola)

1. **Supabase** · nuovo progetto `interfluid-banco-digitale` (organizzazione INTERFLUID SRL, regione Frankfurt).
   - SQL Editor: eseguire `supabase/01_schema_vetrina_accordi.sql`, poi `supabase/02_dati_accordi_marzocchi_2027.sql`.
   - Authentication › Sign In / Providers › Email: disattivare "Allow new users to sign up".
   - Authentication › URL Configuration: Site URL `https://banco.digitale.interfluid.net`,
     Redirect URLs `https://banco.digitale.interfluid.net/auth/conferma`.
2. **Vercel** · nuovo progetto da questo repository, variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY,
   dominio `banco.digitale.interfluid.net` (record CNAME verso Vercel nel DNS di interfluid.net).
3. **Inviti** · Authentication › Users › Invite user con l'email del cliente, poi in Table Editor una riga in
   `utenti_clienti` (user_id dell'utente invitato, cliente `001684` o `000061`, nome).

## Sviluppo

```
npm install
cp .env.example .env.local   # e inserire i valori
npm run dev
```
