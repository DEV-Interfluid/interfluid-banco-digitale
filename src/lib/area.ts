import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { creaClientSupabase } from "./supabase/server";

export type Riga = { codice: string; serie: string | null; prezzo: number; magazzino: boolean };
export type Accordo = {
  id: number; brand: string; anno: number; validoDal: string; validoAl: string;
  soglia: number; bonusPct: number; note: string | null;
  fatturato: number | null; fatturatoAl: string | null; disponibilitaAl: string | null; listino: Riga[];
};
export type Area = { email: string; nome: string | null; cliente: string; ragioneSociale: string; accordi: Accordo[] };

/** Dati del cliente collegato. Le regole del database restituiscono solo le sue righe. */
export const caricaArea = cache(async (): Promise<Area | "non_abilitato"> => {
  const supabase = await creaClientSupabase();
  const { data: c } = await supabase.auth.getClaims();
  if (!c?.claims?.sub) redirect("/accesso");
  const email = typeof c.claims.email === "string" ? c.claims.email : "";

  const { data: u } = await supabase.from("utenti_clienti").select("cliente, nome, attivo").maybeSingle();
  if (!u || !u.attivo) return "non_abilitato";

  const [{ data: cli }, { data: acc, error }] = await Promise.all([
    supabase.from("clienti").select("codice, ragione_sociale").maybeSingle(),
    supabase.from("accordi")
      .select("id, brand, anno, valido_dal, valido_al, soglia_bonus, bonus_pct, note, fatturato(importo_netto, aggiornato_al), listino(codice, serie, prezzo_netto, a_magazzino, disponibilita_al)")
      .order("anno", { ascending: false }),
  ]);
  if (error) throw new Error("Lettura dell'accordo non riuscita");

  const accordi: Accordo[] = (acc ?? []).map((a) => {
    const f = Array.isArray(a.fatturato) ? a.fatturato[0] : a.fatturato;
    const righe = (a.listino ?? []) as { codice: string; serie: string | null; prezzo_netto: number; a_magazzino: boolean; disponibilita_al: string | null }[];
    const date = righe.map((r) => r.disponibilita_al).filter(Boolean).sort() as string[];
    return {
      id: a.id, brand: a.brand, anno: a.anno, validoDal: a.valido_dal, validoAl: a.valido_al,
      soglia: Number(a.soglia_bonus), bonusPct: Number(a.bonus_pct), note: a.note,
      fatturato: f ? Number(f.importo_netto) : null, fatturatoAl: f?.aggiornato_al ?? null,
      disponibilitaAl: date.at(-1) ?? null,
      listino: righe
        .map((r) => ({ codice: r.codice, serie: r.serie, prezzo: Number(r.prezzo_netto), magazzino: r.a_magazzino }))
        .sort((x, y) => x.codice.localeCompare(y.codice, "it", { numeric: true })),
    };
  });

  return { email, nome: u.nome, cliente: u.cliente, ragioneSociale: cli?.ragione_sociale ?? u.cliente, accordi };
});

/** Registro degli accessi: non blocca mai la pagina. */
export async function registra(azione: "accesso" | "listino" | "calcolo" | "scarica_excel") {
  try {
    const supabase = await creaClientSupabase();
    await supabase.from("accessi").insert({ azione });
  } catch {
    /* il registro non deve fermare il cliente */
  }
}
