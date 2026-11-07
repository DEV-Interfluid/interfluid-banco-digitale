# interfluid-banco-digitale — area riservata clienti con accordo

Sito per i clienti Interfluid con un accordo quadro (dal 2027: Hydroservice e Faro, pompe Marzocchi).
Il cliente vede solo: prezzi netti del suo accordo, disponibilità a Gallarate, fatturato dell'anno e
avanzamento verso il bonus. Proprietario e decisore: Giampaolo Sala. Indirizzo: banco.digitale.interfluid.net.

## Perché un database separato (decisione G. Sala, 07/11/2026)

Il database del cruscotto (`interfluid-cruscotti`) contiene costi, margini, tier e dati di tutti i clienti, e oggi
non è pensato per utenti esterni. Questa app usa un progetto Supabase **separato** (`interfluid-banco-digitale`)
che contiene solo ciò che i clienti possono vedere. È una vetrina: anche nel caso peggiore un cliente vede solo
i propri prezzi. Quando il database del cruscotto sarà messo in sicurezza, l'area confluirà nel Banco.

## Regole di sicurezza (non negoziabili)

1. Nell'app solo URL e chiave `anon` del progetto vetrina. **Mai** la `service_role`, mai credenziali del cruscotto.
2. Le regole del database (RLS) mostrano a ogni utente solo le righe del suo cliente (`mio_cliente()`). L'app non
   filtra al posto del database: se una lettura restituisce dati di un altro cliente è un errore grave da segnalare.
3. Nessun costo, margine, tier, sconto fornitore, codice gestionale o dato di altri clienti nella vetrina.
4. Gli utenti esistono solo su invito; "Allow new users to sign up" resta **disattivato**; l'accesso è con link via
   email (`shouldCreateUser: false`). Un accesso si revoca con `utenti_clienti.attivo = false`.
5. Le chiamate al database si fanno dal server. `.env.local` non va mai nel repository.

## Chi scrive nel database

- Schema e dati iniziali: `supabase/01_schema_vetrina_accordi.sql`, `supabase/02_dati_accordi_marzocchi_2027.sql`.
- Aggiornamenti: solo il flusso n8n "Banco Digitale · sincronizzazione" (notte), con la chiave di servizio del
  progetto vetrina conservata solo in n8n. Aggiorna `listino.a_magazzino` / `disponibilita_al` (giacenze del
  cruscotto) e `fatturato` (fatture meno note di credito dall'export settimanale di Mago).
- I prezzi dell'accordo sono congelati per l'anno: cambiano solo con una decisione di G. Sala.

## Modo di lavorare

Testi in italiano, chiari. Stile Interfluid (Interfluid_Style_Guide v1.0): Quicksand, navy #2D3853, blu #5279C0,
arancio oleodinamica #F7A82C. Una pull request per attività, versione in package.json. Giampaolo non è uno
sviluppatore: istruzioni passo per passo quando deve fare qualcosa.
