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
4. Gli utenti esistono solo su invito; "Allow new users to sign up" resta **disattivato**; l'accesso è con un codice
   via email scritto nella pagina di accesso (`shouldCreateUser: false`, `verifyOtp` tipo email; G. Sala 13/11/2026: il link
   si rompeva se aperto in un altro browser o "bruciato" dai filtri antispam). Il modello email "Magic link" mostra `{{ .Token }}`. Un accesso si revoca con `utenti_clienti.attivo = false`.
5. Le chiamate al database si fanno dal server. `.env.local` non va mai nel repository.

## Chi scrive nel database

- Schema: `supabase/01_schema_vetrina_accordi.sql`, `02_dati_accordi_marzocchi_2027.sql`, `03_catalogo_richieste.sql`,
  `04_sincronizza_catalogo.sql`, `05_avviso_richieste.sql`, `06_chiavi_equivalenza.sql`, `07_confronti_tecnici.sql`
  (funzioni usate solo da n8n, chiave segreta della vetrina).
- Il cruscotto calcola, la vetrina mostra. Perimetro per cliente (brand/famiglie, stock/su ordine) e prezzi stanno
  nel cruscotto (`banco_perimetro`, parametro `intercompany` per cliente, `calcola_prezzo`). La funzione del
  cruscotto `banco_export(cliente, data)` produce il catalogo pronto da mostrare (solo prezzo netto, mai costi).
- Aggiornamenti: solo il flusso n8n "Banco Digitale · sincronizzazione" (notte), con la chiave di servizio del
  progetto vetrina conservata solo in n8n (flusso ItKGfAmGbQuGSDr8, ogni mattina 07:10): cruscotto `banco_clienti()` e
  `banco_export_json(cliente)`, vetrina `sincronizza_catalogo()`. Sostituisce le righe del cliente in `catalogo`, scrive `sincronizzazioni`
  e aggiorna `fatturato` (fatture meno note di credito dall'export settimanale di Mago). Per i clienti con accordo
  non ancora in vigore i prezzi si calcolano alla data di inizio dell'accordo (Marzocchi: 2027-01-01).
- Le richieste d'ordine si scrivono solo con la funzione `invia_richiesta()`: i prezzi si rileggono dal catalogo,
  mai dal browser. Il flusso n8n "Banco Digitale · avviso richieste" (QlZ968WRrjyb2ehB, ogni 5 minuti) manda
  un'email all'owner HubSpot del cliente (codice_erp) e crea un compito HubSpot; senza owner l'avviso va a G. Sala.
- I prezzi dell'accordo sono congelati per l'anno: cambiano solo con una decisione di G. Sala.

## Riconoscimento dei codici e alternative (G. Sala 12/11/2026)

- `src/lib/riconosci.ts`: una riga incollata = una richiesta; spazi, trattini e barre non contano. Si riconosce dal
  codice del catalogo, dai numeri R e dalle sigle Rexroth (`catalogo.chiavi`, dalla tabella `alternative_codice` del
  cruscotto) e, per le direzionali 4WE 6/4WE 10, dalla firma taglia + cursore + tensione.
- Sicurezza: due direzionali con firma diversa (es. 12 V e 24 V) non sono mai equivalenti, anche se la tabella del
  cruscotto lo dice. I suggerimenti per i codici non riconosciuti non si scelgono mai da soli.
  Eccezione per le pompe (G. Sala 12/11/2026, da rivedere se porta errori): la sigla scritta senza la serie finale
  (EIPH2-008RK03 per EIPH2-008RK03-11, al massimo 3 caratteri in meno) o con la serie scritta con la X dei costruttori
  (EIPH2-008RK03-1X, PGH3-20 per PGH3-2X) si riconosce da sola, come equivalente, solo se
  corrisponde a una sola sigla di pompa con confronto validato. Se le sigle possibili sono più di una resta un suggerimento.
- La fascia "Alternative" compare solo se esistono equivalenti nel catalogo del cliente. Nella richiesta resta
  `richiesto`, il codice come l'ha scritto il cliente.

## Confronti tecnici delle pompe (G. Sala 12/11/2026)

- `catalogo.confronti`: per le alternative Hydraut a ingranaggi interni, le pompe Rexroth, Eckerle e Voith che
  sostituiscono, dal comparatore del cruscotto (`banco_confronti_codice`): solo coppie validate con verdetto DROP-IN o
  COMPATIBILE CON ADATTATORI, solo dati tecnici. Il comparatore resta l'unica fonte del giudizio: il Banco non lo ricalcola.
- Nella lista: verdetto in una riga e "Confronta", che apre il pannello affiancato (`src/components/confronto.tsx`)
  con le differenze evidenziate e cosa serve per montarla. Il kit di adattamento lo quota il commerciale.
- Il perimetro decide quali famiglie hanno alternative (`banco_perimetro.alternative`): le alternative validate senza
  prezzo né giacenza restano a catalogo con prezzo "su richiesta".

## Modo di lavorare

Testi in italiano, chiari. Stile del concept Banco (decisione G. Sala, 12/11/2026): Urbanist e JetBrains Mono per
i codici, testata scura #191C1F, oro #F8AB2F, fondo #F2F4F5, carte bianche con bordo #E4E7E9 e raggio 12. Una pull request per attività, versione in package.json. Giampaolo non è uno
sviluppatore: istruzioni passo per passo quando deve fare qualcosa.
