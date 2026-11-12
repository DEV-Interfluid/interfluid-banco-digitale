# interfluid-banco-digitale — area riservata clienti con accordo

Il "Banco": strumento per i distributori fidelizzati Interfluid (decisione G. Sala, 12/11/2026), estensione del
cruscotto commerciale. Clienti: Parmafluid 009073 (intercompany), Hydroservice 001684 e Faro Oleodinamica 000061
(accordo Marzocchi dal 1/1/2027). Il cliente vede solo: il suo catalogo con prezzi netti, disponibilità, le sue
richieste d'ordine e, se ha un accordo, fatturato e avanzamento verso il bonus. Invia richieste d'ordine che il
commerciale (owner HubSpot) conferma: una richiesta non è un ordine. Proprietario e decisore: Giampaolo Sala.
Indirizzo: banco.digitale.interfluid.net.

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

- Schema: `supabase/01_schema_vetrina_accordi.sql`, `02_dati_accordi_marzocchi_2027.sql`, `03_catalogo_richieste.sql`,
  `04_sincronizza_catalogo.sql` (funzione usata solo da n8n, chiave segreta della vetrina).
- Il cruscotto calcola, la vetrina mostra. Perimetro per cliente (brand/famiglie, stock/su ordine) e prezzi stanno
  nel cruscotto (`banco_perimetro`, parametro `intercompany` per cliente, `calcola_prezzo`). La funzione del
  cruscotto `banco_export(cliente, data)` produce il catalogo pronto da mostrare (solo prezzo netto, mai costi).
- Aggiornamenti: solo il flusso n8n "Banco Digitale · sincronizzazione" (notte), con la chiave di servizio del
  progetto vetrina conservata solo in n8n (flusso ItKGfAmGbQuGSDr8, ogni mattina 07:10): cruscotto `banco_clienti()` e
  `banco_export_json(cliente)`, vetrina `sincronizza_catalogo()`. Sostituisce le righe del cliente in `catalogo`, scrive `sincronizzazioni`
  e aggiorna `fatturato` (fatture meno note di credito dall'export settimanale di Mago). Per i clienti con accordo
  non ancora in vigore i prezzi si calcolano alla data di inizio dell'accordo (Marzocchi: 2027-01-01).
- Le richieste d'ordine si scrivono solo con la funzione `invia_richiesta()`: i prezzi si rileggono dal catalogo,
  mai dal browser.
- I prezzi dell'accordo sono congelati per l'anno: cambiano solo con una decisione di G. Sala.

## Modo di lavorare

Testi in italiano, chiari. Stile del concept Banco (decisione G. Sala, 12/11/2026): Urbanist e JetBrains Mono per
i codici, testata scura #191C1F, oro #F8AB2F, fondo #F2F4F5, carte bianche con bordo #E4E7E9 e raggio 12. Una pull request per attività, versione in package.json. Giampaolo non è uno
sviluppatore: istruzioni passo per passo quando deve fare qualcosa.
