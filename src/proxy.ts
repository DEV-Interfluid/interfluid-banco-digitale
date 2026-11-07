import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Gira prima di ogni pagina: rinnova la sessione e manda all'accesso chi non è collegato.
// È il primo controllo; le pagine e il database ricontrollano per conto loro.
export async function proxy(request: NextRequest) {
  let risposta = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(daImpostare) {
        daImpostare.forEach(({ name, value }) => request.cookies.set(name, value));
        risposta = NextResponse.next({ request });
        daImpostare.forEach(({ name, value, options }) => risposta.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const libera = request.nextUrl.pathname.startsWith("/accesso") || request.nextUrl.pathname.startsWith("/auth/");
  if (!data?.claims?.sub && !libera) {
    const url = request.nextUrl.clone();
    url.pathname = "/accesso";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return risposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
