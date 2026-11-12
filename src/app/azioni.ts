"use server";

import { revalidatePath } from "next/cache";

import { registra } from "@/lib/area";
import { creaClientSupabase } from "@/lib/supabase/server";

export type EsitoRichiesta = { id: number | null; errore: string | null };

/**
 * Invia una richiesta d'ordine. Il browser manda solo codici e quantità: i prezzi
 * li rilegge il database dal catalogo del cliente (funzione invia_richiesta).
 */
export async function inviaRichiesta(righe: { codice: string; qta: number }[], riferimento: string, note: string): Promise<EsitoRichiesta> {
  const pulite = righe
    .map((r) => ({ codice: String(r.codice).trim().slice(0, 80), qta: Math.max(0, Math.round(Number(r.qta) * 100) / 100) }))
    .filter((r) => r.codice && r.qta > 0)
    .slice(0, 200);
  if (pulite.length === 0) return { id: null, errore: "La richiesta è vuota." };
  const supabase = await creaClientSupabase();
  const { data, error } = await supabase.rpc("invia_richiesta", {
    p_righe: pulite, p_riferimento: riferimento.slice(0, 120), p_note: note.slice(0, 2000),
  });
  if (error) return { id: null, errore: "Invio non riuscito. Riprova o scrivi al tuo commerciale." };
  await registra("richiesta");
  revalidatePath("/");
  return { id: Number(data), errore: null };
}
