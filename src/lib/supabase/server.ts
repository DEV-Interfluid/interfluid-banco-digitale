import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase lato server: chiave pubblica (anon) + sessione del cliente collegato.
// Mai la chiave service_role in questa app. Le regole del database (RLS) mostrano a ogni
// cliente solo le proprie righe, qualunque cosa chieda l'app.
export async function creaClientSupabase() {
  const archivio = await cookies();
  return createServerClient(variabile("NEXT_PUBLIC_SUPABASE_URL"), variabile("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => archivio.getAll(),
      setAll(daImpostare) {
        try {
          daImpostare.forEach(({ name, value, options }) => archivio.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: i cookie li aggiorna il proxy.
        }
      },
    },
  });
}

export function variabile(nome: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const v = nome === "NEXT_PUBLIC_SUPABASE_URL" ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error(`Manca ${nome} nelle variabili d'ambiente`);
  return v;
}
