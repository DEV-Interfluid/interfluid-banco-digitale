"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { creaClientSupabase } from "@/lib/supabase/server";

export type StatoAccesso = { inviato: boolean; errore: string | null; email?: string };

/** Invia il link di accesso. Non crea mai utenti: si entra solo su invito di Interfluid. */
export async function inviaLink(_prima: StatoAccesso, dati: FormData): Promise<StatoAccesso> {
  const email = String(dati.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { inviato: false, errore: "Scrivi un indirizzo email valido." };
  const h = await headers();
  const origine = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await creaClientSupabase();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origine}/auth/conferma` } });
  // troppe email in poco tempo: lo diciamo, altrimenti si aspetta un codice che non arriverà
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return { inviato: false, errore: "Hai chiesto troppi codici in poco tempo. Aspetta qualche minuto e riprova." };
  }
  // Stessa risposta in ogni caso: non riveliamo quali indirizzi sono abilitati.
  return { inviato: true, errore: null, email };
}

/** Entra con il codice ricevuto per email: funziona da qualsiasi browser, senza link da cliccare. */
export async function verificaCodice(_prima: StatoAccesso, dati: FormData): Promise<StatoAccesso> {
  const email = String(dati.get("email") ?? "").trim().toLowerCase();
  const codice = String(dati.get("codice") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(codice)) return { inviato: true, email, errore: "Scrivi il codice di 6 cifre ricevuto per email." };
  const supabase = await creaClientSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token: codice, type: "email" });
  if (error) return { inviato: true, email, errore: "Il codice non è valido o è scaduto. Controlla le cifre o chiedine uno nuovo." };
  redirect("/");
}

export async function esci() {
  const supabase = await creaClientSupabase();
  await supabase.auth.signOut();
  redirect("/accesso");
}
