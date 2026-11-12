/**
 * Riconoscimento dei codici incollati dal cliente (G. Sala 12/11/2026).
 *
 * Una riga incollata = una richiesta. Le colonne (tabulazioni, punto e virgola, due o più spazi) si provano una per
 * una; spazi, trattini, punti e barre non contano. Una riga si riconosce da:
 *   C: il codice del catalogo (anche senza il prefisso HD- delle HUADE)
 *   R: un numero R Rexroth (R900561288) presente tra gli equivalenti del catalogo
 *   T: una sigla Rexroth (4WE 6 J6X/EG24N9K4) presente tra gli equivalenti del catalogo
 *   F: la "firma" delle direzionali 4WE 6 e 4WE 10 (taglia, cursore, tensione), qualunque sia la serie
 *      (6X, 60, 61B) o la lettera del collegamento (E, C). Varianti con opzioni (guarnizioni V, strozzatori B..,
 *      esecuzioni speciali SO) non hanno firma e non vengono abbinate; OF (senza comando manuale) è una firma a sé.
 * Controllo di sicurezza: un abbinamento R/T tra due direzionali con firma diversa (es. 12 V contro 24 V) si scarta,
 * anche se la tabella delle equivalenze del cruscotto lo riporta.
 * Le alternative di un codice sono gli altri codici del catalogo che condividono con lui una chiave R, T o F.
 * Pompe (G. Sala 12/11/2026): se la riga indica una pompa del cliente presente nei confronti validati del comparatore,
 * la riga porta il confronto; tra più alternative si preferisce il verdetto DROP-IN, poi la disponibilità.
 */
import type { Confronto, Voce } from "./area";

export const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const FIRMA = /^(?:HD)?4WE(6|10)([A-Z]{1,2}?)(?:6X|5X|3X|6[0-9]|5[0-9]|3[0-9])B?(OF)?[EC]?(G12|G24|W110|W220|W230)(?:50)?N9?K4(?:Z5LS)?M?(?:10|BP)?$/;

/** Firma di una direzionale 4WE6/4WE10 standard, es. "4WE6|J|G24"; null se non è una direzionale standard. */
export function firma(s: string): string | null {
  const m = norm(s).match(FIRMA);
  if (!m) return null;
  const tens = m[4] === "W220" ? "W230" : m[4];
  return `4WE${m[1]}|${m[2]}|${tens}${m[3] ? "|OF" : ""}`;
}

export type Indice = { chiavi: Map<string, Voce[]>; perCodice: Map<string, Voce> };

export function creaIndice(catalogo: Voce[]): Indice {
  const chiavi = new Map<string, Voce[]>();
  const add = (k: string, v: Voce) => { const l = chiavi.get(k); if (!l) chiavi.set(k, [v]); else if (!l.includes(v)) l.push(v); };
  for (const v of catalogo) {
    const c = norm(v.codice);
    add("C:" + c, v);
    if (c.startsWith("HD")) add("C:" + c.slice(2), v);
    // sigla "di base": il codice senza HD- e senza i suffissi di linea Hydraut (" 10", "/BP"); collega le versioni
    // della stessa valvola e coincide con la sigla Rexroth quando il codice Hydraut la riprende (Z2FS10-5-3X/V 10)
    const base = norm(v.codice.trim().replace(/^HD-/i, "").replace(/(\s10|\/BP)$/i, ""));
    if (base.length >= 5) add("T:" + base, v);
    for (const k of v.chiavi ?? []) add(k, v);
    const f = firma(v.codice);
    if (f) add("F:" + f, v);
  }
  return { chiavi, perCodice: new Map(catalogo.map((v) => [v.codice, v])) };
}

/** Chiavi di equivalenza di un codice (R, T, F): servono a trovare le alternative. */
function chiaviEquivalenza(v: Voce): string[] {
  const out = (v.chiavi ?? []).slice();
  const base = norm(v.codice.trim().replace(/^HD-/i, "").replace(/(\s10|\/BP)$/i, ""));
  if (base.length >= 5) out.push("T:" + base);
  const f = firma(v.codice);
  if (f) out.push("F:" + f);
  return out;
}

/** Due codici sono compatibili se non sono entrambi direzionali con firma diversa. */
const compatibili = (fa: string | null, fb: string | null) => !fa || !fb || fa === fb;

/** Gli altri codici del catalogo equivalenti a questo. */
export function alternative(ix: Indice, v: Voce): Voce[] {
  const s = new Set<Voce>(), fv = firma(v.codice);
  for (const k of chiaviEquivalenza(v)) for (const x of ix.chiavi.get(k) ?? []) if (x !== v && compatibili(fv, firma(x.codice))) s.add(x);
  return [...s];
}

const cifra = (c: string | undefined) => !!c && c >= "0" && c <= "9";

/** Una sigla di pompa del catalogo (x) corrisponde a quella scritta (n): n è x, o x senza la serie finale (al massimo
 *  3 caratteri in meno), e la serie si può scrivere con la X dei costruttori (1X = serie 10-19, 2X = 20-29):
 *  EIPH2-011RK03-1X vale EIPH2-011RK03-11, PGH3-20/011RE07VU2 vale PGH3-2X/011RE07VU2. */
export function siglaPompa(x: string, n: string): boolean {
  if (n.length < 8 || n.length > x.length || x.length - n.length > 3) return false;
  for (let i = 0; i < n.length; i++) {
    const a = x[i], b = n[i];
    if (a === b) continue;
    const serie = cifra(x[i - 1]) && x[i - 1] === n[i - 1] && ((a === "X" && cifra(b)) || (b === "X" && cifra(a)));
    if (!serie) return false;
  }
  return true;
}

/** Pompe: la sigla scritta senza la serie finale o con la serie "1X" (EIPH2-008RK03 o EIPH2-008RK03-1X per
 *  EIPH2-008RK03-11). Decisione G. Sala 12/11/2026: si riconosce da sola solo se corrisponde a una sola sigla di
 *  pompa con confronto validato; se le sigle possibili sono più di una resta un suggerimento. Le valvole sono escluse. */
function pompaSenzaSerie(ix: Indice, n: string): Voce[] {
  if (n.length < 8) return [];
  let sigla: string | null = null;
  let voci: Voce[] = [];
  for (const [k, vv] of ix.chiavi) {
    if (!k.startsWith("T:")) continue;
    const x = k.slice(2);
    if (x === n || !siglaPompa(x, n)) continue;
    const pompe = vv.filter((v) => v.confronti?.some((c) => c.chiavi?.includes(k)));
    if (!pompe.length) continue;
    if (sigla && sigla !== x) return [];
    sigla = x; voci = pompe;
  }
  return voci;
}

/** Candidati per un testo (una cella): prima il codice esatto, poi numero R, sigla, firma, sigla di pompa senza serie. */
function candidati(ix: Indice, testo: string, fLinea: string | null = null): { voci: Voce[]; esatto: boolean; parziale?: boolean } {
  const n = norm(testo);
  if (n.length < 3) return { voci: [], esatto: false };
  const esatti = ix.chiavi.get("C:" + n) ?? (n.startsWith("HD") ? ix.chiavi.get("C:" + n.slice(2)) : undefined);
  if (esatti?.length) return { voci: esatti, esatto: true };
  const s = new Set<Voce>();
  const f = firma(n) ?? fLinea;
  // per un numero R la firma si ricava dalla sigla degli equivalenti con chiave T; per una sigla, dalla sigla stessa
  for (const k of ["R:" + n, "T:" + n]) for (const v of ix.chiavi.get(k) ?? []) if (compatibili(f, firma(v.codice))) s.add(v);
  if (f) for (const v of ix.chiavi.get("F:" + f) ?? []) s.add(v);
  if (!s.size) { const p = pompaSenzaSerie(ix, n); if (p.length) return { voci: p, esatto: false, parziale: true }; }
  return { voci: filtraFirmaMaggioritaria([...s]), esatto: false };
}

/** Se un numero R porta a direzionali con firme diverse (equivalenza sbagliata), tiene la firma più frequente:
 *  le sigle Rexroth degli equivalenti con quel numero dicono quale è giusta. */
function filtraFirmaMaggioritaria(voci: Voce[]): Voce[] {
  const conta = new Map<string, number>();
  for (const v of voci) { const f = firma(v.codice); if (f) conta.set(f, (conta.get(f) ?? 0) + 1); }
  if (conta.size <= 1) return voci;
  const tipo = voci.map((v) => (v.chiavi ?? []).find((k) => k.startsWith("T:"))).find(Boolean);
  const fT = tipo ? firma(tipo.slice(2)) : null;
  const top = fT && conta.has(fT) ? fT : [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return voci.filter((v) => { const f = firma(v.codice); return !f || f === top; });
}

/** Il confronto di un codice con la pompa indicata nel testo (sigla o numero del costruttore), se c'è.
 *  Vale anche la sigla scritta senza la serie finale (EIPH2-008RK03 per EIPH2-008RK03-11): il codice è già stato
 *  scelto (riconosciuto o indicato dal cliente), qui si cerca solo quale delle sue pompe confrontare. */
export function confrontoPer(v: Voce, testo: string): Confronto | undefined {
  if (!v.confronti?.length) return undefined;
  const n = norm(testo);
  if (!n) return undefined;
  const pieno = (x: string) => x.length >= 6 && n.includes(x);
  const senzaSerie = (x: string) => siglaPompa(x, n);
  return v.confronti.find((c) => (c.chiavi ?? []).some((k) => pieno(k.slice(2))))
    ?? v.confronti.find((c) => (c.chiavi ?? []).some((k) => k.startsWith("T:") && senzaSerie(k.slice(2))));
}

/** Il confronto con una pompa precisa (stesso modello del cliente). */
export const confrontoModello = (v: Voce, modello?: string) => (modello ? v.confronti?.find((c) => c.modello === modello) : undefined);

const rangoVerdetto = (c?: Confronto) => (!c ? 1 : c.verdetto === "DROP-IN" ? 0 : 1);

/** Il codice proposto tra più equivalenti: chi copre la quantità, poi chi ha pezzi pronti, poi il prezzo più basso. */
export function migliore(voci: Voce[], q: number, testo = ""): Voce {
  const punteggio = (v: Voce) => (v.disponibilita === "disponibile" && (v.disponibile ?? 0) >= q ? 0 : v.disponibilita === "disponibile" ? 1 : 2);
  return voci.slice().sort((a, b) => rangoVerdetto(confrontoPer(a, testo)) - rangoVerdetto(confrontoPer(b, testo)) || punteggio(a) - punteggio(b) || (a.esaurimento ? 1 : 0) - (b.esaurimento ? 1 : 0)
    || (a.prezzo ?? Infinity) - (b.prezzo ?? Infinity) || a.codice.localeCompare(b.codice))[0];
}

export type Riga = { testo: string; q: number; qEsplicita: boolean; v?: Voce; equivalente: boolean; confronto?: Confronto };

const QTA = /^\d{1,5}(?:[.,]0+)?$/;
const numeroR = /\bR9\d{8}\b/i;

/** Legge una lista incollata (email, Excel, ordine) e la trasforma in righe riconosciute. */
export function leggiLista(testo: string, ix: Indice): Riga[] {
  const righe: Riga[] = [];
  // colonne incollate su righe alterne: una riga con il solo numero R si unisce alla riga successiva
  const linee: string[] = [];
  for (const l of testo.split(/\r?\n/)) {
    const prec = linee[linee.length - 1];
    if (prec !== undefined && /^R9\d{8}$/i.test(norm(prec)) && l.trim() && !/^R9\d{8}$/i.test(norm(l))) linee[linee.length - 1] = `${prec.trim()}\t${l.trim()}`;
    else linee.push(l);
  }
  for (const grezza of linee) {
    const linea = grezza.trim();
    if (linea.replace(/[^A-Za-z0-9]/g, "").length < 3) continue;
    let celle = linea.split(/\t|;|\s{2,}|\s\|\s/).map((c) => c.trim()).filter(Boolean);
    let q = 1, qEsplicita = false;
    // quantità: una cella solo numerica (dopo almeno una cella di codice), oppure "x 10", "pz 10", "n. 10" in fondo
    const qi = celle.findIndex((c, i) => i > 0 && QTA.test(c));
    if (qi > 0) { q = Number(celle[qi].replace(",", ".")); qEsplicita = true; celle = celle.filter((_, i) => i !== qi); }
    else {
      const m = linea.match(/\s(?:x|pz\.?|n\.?|qt[aà]\.?)\s*(\d{1,5})\s*$/i);
      if (m) { q = Number(m[1]); qEsplicita = true; celle = [linea.slice(0, m.index).trim()]; }
    }
    // prova: il numero R ovunque nella riga, poi ogni cella, poi la riga intera, poi la riga senza un numero finale
    const tentativi: string[] = [];
    const r = linea.match(numeroR); if (r) tentativi.push(r[0]);
    tentativi.push(...celle, celle.join(" "));
    // la sigla scritta nella riga (se è una direzionale) vincola taglia, cursore e tensione anche per il numero R
    const fLinea = [...celle, celle.join(" ")].map(firma).find(Boolean) ?? null;
    let trovato: { voci: Voce[]; esatto: boolean; parziale?: boolean } = { voci: [], esatto: false };
    for (const t of tentativi) { trovato = candidati(ix, t, fLinea); if (trovato.voci.length) break; }
    // numero finale dopo uno spazio: è una quantità solo se la riga intera non è già un codice esatto
    // (le Hydraut finiscono con " 10", che non è una quantità)
    if (!trovato.esatto && !qEsplicita) {
      const m = linea.match(/^(.*\S)\s+(\d{1,5})$/);
      if (m) {
        const sR = m[1].match(numeroR);
        const fT = firma(m[1].replace(numeroR, "")) ?? fLinea;
        let t = candidati(ix, m[1], fT);
        if (!t.voci.length && sR) t = candidati(ix, sR[0], fT);
        // una sigla completa trovata (EIPH2-008RK03 11 = EIPH2-008RK03-11) vale più della stessa sigla senza serie con quantità
        const peggiora = trovato.voci.length && !trovato.parziale && t.parziale;
        if (!peggiora && (t.voci.length || (!trovato.voci.length && sR))) { trovato = t; q = Number(m[2]); qEsplicita = true; celle = [m[1]]; }
      }
    }
    // il testo del codice senza la quantità: serve a trovare la pompa da confrontare anche senza la serie finale
    const testoCodice = celle.join(" ");
    const v = trovato.voci.length ? migliore(trovato.voci, q, testoCodice) : undefined;
    const testoRiga = celle.join("  ");
    // (le colonne incollate su righe alterne sono già state unite prima della lettura: ogni riga è una richiesta)
    righe.push({ testo: testoRiga, q, qEsplicita, v, equivalente: !!v && !trovato.esatto, confronto: v ? confrontoPer(v, testoCodice) ?? confrontoPer(v, linea) : undefined });
  }
  return righe;
}


/** Per una riga non riconosciuta: codici con sigla quasi uguale (una o due lettere in più o in meno in fondo,
 *  es. ZDR 6 DA2-4X/210Y e ZDR6DA2-4X/210YM). Solo suggerimenti: non vengono mai scelti in automatico. */
export function suggerimenti(ix: Indice, testo: string): Voce[] {
  const n = norm(testo.replace(numeroR, ""));
  if (n.length < 6) return [];
  const out = new Set<Voce>();
  for (const [k, voci] of ix.chiavi) {
    if (!k.startsWith("T:")) continue;
    const b = k.slice(2);
    if (b !== n && Math.abs(b.length - n.length) <= 2 && (b.startsWith(n) || n.startsWith(b))) for (const v of voci) out.add(v);
    if (out.size >= 6) break;
  }
  return [...out].slice(0, 6);
}
