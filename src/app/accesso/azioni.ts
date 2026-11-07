"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { creaClientSupabase } from "@/lib/supabase/server";

export type StatoAccesso = { inviato: boolean; errore: string | null };

/** Invia il link di accesso. Non crea mai utenti: si entra solo su invito di Interfluid. */
export async function inviaLink(_prima: StatoAccesso, dati: FormData): Promise<StatoAccesso> {
  const email = String(dati.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { inviato: false, errore: "Scrivi un indirizzo email valido." };
  const h = await headers();
  const origine = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await creaClientSupabase();
  await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origine}/auth/conferma` } });
  // Stessa risposta in ogni caso: non riveliamo quali indirizzi sono abilitati.
  return { inviato: true, errore: null };
}

export async function esci() {
  const supabase = await creaClientSupabase();
  await supabase.auth.signOut();
  redirect("/accesso");
}
