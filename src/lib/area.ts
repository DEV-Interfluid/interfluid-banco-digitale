import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { creaClientSupabase } from "./supabase/server";

/** Dati tecnici di una pompa nel confronto (dal comparatore del cruscotto). */
export type DatiPompa = {
  modello?: string; cilindrata?: number; p_nom?: number; p_picco?: number; rpm_max?: number; rotazione?: string;
  flangia?: string; albero?: string; l1?: number; porte?: string; aspirazione?: string; mandata?: string; guarnizioni?: string;
};
/** Confronto validato tra la pompa del cliente (Rexroth, Eckerle, Voith) e l'alternativa del catalogo. */
export type Confronto = {
  modello: string; brand: string; verdetto: "DROP-IN" | "COMPATIBILE CON ADATTATORI" | string; chiavi: string[];
  cliente: DatiPompa; nostra: DatiPompa;
  adattamenti: { classe?: string; lanterna?: string; semigiunto?: string; aspirazione?: string; mandata?: string; puo_invertire_rotazione?: boolean };
  avvisi: string[];
};

/** Una riga del catalogo del cliente: prezzo netto (null = su richiesta) e disponibilità. */
export type Voce = {
  codice: string; descrizione: string | null; brand: string; serie: string | null;
  prezzo: number | null; modalita: "stock" | "su_ordine"; disponibile: number | null;
  disponibilita: "disponibile" | "da_ordinare" | null; esaurimento: boolean; accordo: boolean;
  /** chiavi di equivalenza dal cruscotto: numeri R (R:...) e sigle (T:...) degli equivalenti */
  chiavi: string[];
  /** confronti tecnici validati (pompe): presenti solo per le alternative del comparatore */
  confronti: Confronto[];
};
export type Accordo = {
  id: number; brand: string; anno: number; validoDal: string; validoAl: string;
  soglia: number; bonusPct: number; note: string | null;
  fatturato: number | null; fatturatoAl: string | null;
};
export type Richiesta = { id: number; riferimento: string | null; totale: number | null; stato: string; creata: string; righe: number };
export type Area = {
  email: string; nome: string | null; cliente: string; ragioneSociale: string;
  accordi: Accordo[]; catalogo: Voce[]; aggiornatoIl: string | null; richieste: Richiesta[];
};

const PAGINA = 1000;

/** Dati del cliente collegato. Le regole del database restituiscono solo le sue righe. */
export const caricaArea = cache(async (): Promise<Area | "non_abilitato"> => {
  const supabase = await creaClientSupabase();
  const { data: c } = await supabase.auth.getClaims();
  if (!c?.claims?.sub) redirect("/accesso");
  const email = typeof c.claims.email === "string" ? c.claims.email : "";

  const { data: u } = await supabase.from("utenti_clienti").select("cliente, nome, attivo").maybeSingle();
  if (!u || !u.attivo) return "non_abilitato";

  const [{ data: cli }, { data: acc, error }, { data: sinc }, { data: ric }] = await Promise.all([
    supabase.from("clienti").select("codice, ragione_sociale").maybeSingle(),
    supabase.from("accordi")
      .select("id, brand, anno, valido_dal, valido_al, soglia_bonus, bonus_pct, note, fatturato(importo_netto, aggiornato_al), listino(codice, serie, prezzo_netto, a_magazzino)")
      .order("anno", { ascending: false }),
    supabase.from("sincronizzazioni").select("eseguita_il").maybeSingle(),
    supabase.from("richieste").select("id, riferimento, totale, stato, creata_il, richieste_righe(count)").order("creata_il", { ascending: false }).limit(8),
  ]);
  if (error) throw new Error("Lettura dell'accordo non riuscita");

  // catalogo a pagine (il server restituisce al massimo 1000 righe per lettura)
  const catalogo: Voce[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data: righe, error: e } = await supabase.from("catalogo")
      .select("codice, descrizione, brand, serie, prezzo_netto, modalita, disponibile, disponibilita, esaurimento, accordo, chiavi, confronti")
      .order("codice").range(da, da + PAGINA - 1);
    if (e) throw new Error("Lettura del catalogo non riuscita");
    for (const r of righe ?? []) {
      catalogo.push({
        codice: r.codice, descrizione: r.descrizione, brand: r.brand, serie: r.serie,
        prezzo: r.prezzo_netto == null ? null : Number(r.prezzo_netto), modalita: r.modalita,
        disponibile: r.disponibile == null ? null : Number(r.disponibile), disponibilita: r.disponibilita,
        esaurimento: r.esaurimento, accordo: r.accordo, chiavi: r.chiavi ?? [], confronti: (r.confronti ?? []) as Confronto[],
      });
    }
    if (!righe || righe.length < PAGINA) break;
  }

  const accordi: Accordo[] = (acc ?? []).map((a) => {
    const f = Array.isArray(a.fatturato) ? a.fatturato[0] : a.fatturato;
    return {
      id: a.id, brand: a.brand, anno: a.anno, validoDal: a.valido_dal, validoAl: a.valido_al,
      soglia: Number(a.soglia_bonus), bonusPct: Number(a.bonus_pct), note: a.note,
      fatturato: f ? Number(f.importo_netto) : null, fatturatoAl: f?.aggiornato_al ?? null,
    };
  });

  // Finché la sincronizzazione non ha scritto il catalogo, si usa il listino congelato dell'accordo.
  if (catalogo.length === 0) {
    for (const a of acc ?? []) {
      for (const r of (a.listino ?? []) as { codice: string; serie: string | null; prezzo_netto: number; a_magazzino: boolean }[]) {
        catalogo.push({
          codice: r.codice, descrizione: null, brand: a.brand, serie: r.serie, prezzo: Number(r.prezzo_netto), modalita: "stock",
          disponibile: null, disponibilita: r.a_magazzino ? "disponibile" : "da_ordinare", esaurimento: false, accordo: true, chiavi: [], confronti: [],
        });
      }
    }
    catalogo.sort((x, y) => x.codice.localeCompare(y.codice, "it", { numeric: true }));
  }

  const richieste: Richiesta[] = (ric ?? []).map((r) => {
    const n = Array.isArray(r.richieste_righe) ? (r.richieste_righe[0] as { count?: number } | undefined)?.count : undefined;
    return { id: r.id, riferimento: r.riferimento, totale: r.totale == null ? null : Number(r.totale), stato: r.stato, creata: r.creata_il, righe: n ?? 0 };
  });

  return {
    email, nome: u.nome, cliente: u.cliente, ragioneSociale: cli?.ragione_sociale ?? u.cliente,
    accordi, catalogo, aggiornatoIl: sinc?.eseguita_il ?? null, richieste,
  };
});

/** Registro degli accessi: non blocca mai la pagina. */
export async function registra(azione: "accesso" | "listino" | "calcolo" | "scarica_excel" | "ricerca" | "richiesta") {
  try {
    const supabase = await creaClientSupabase();
    await supabase.from("accessi").insert({ azione });
  } catch {
    /* il registro non deve fermare il cliente */
  }
}
