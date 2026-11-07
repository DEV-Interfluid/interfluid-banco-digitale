import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { creaClientSupabase } from "@/lib/supabase/server";

// Arrivo dal link nell'email: apre la sessione e porta all'area del cliente.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const supabase = await creaClientSupabase();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && tipo) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })).error;

  const dest = url.clone();
  dest.search = "";
  dest.pathname = ok ? "/" : "/accesso";
  if (!ok) dest.searchParams.set("errore", "link");
  return NextResponse.redirect(dest);
}
