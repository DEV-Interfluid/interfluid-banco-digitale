import { AreaAccordo } from "@/components/area-accordo";
import { caricaArea, registra } from "@/lib/area";

import { esci } from "./accesso/azioni";

export default async function Home() {
  const area = await caricaArea();

  if (area === "non_abilitato") {
    return (
      <main className="accesso">
        <div className="scheda">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/interfluid-logo.svg" alt="Interfluid — Your Fluid Mate" className="logo" />
          <h1>Accesso <span>non abilitato</span></h1>
          <p className="intro">Questo indirizzo non è collegato a nessun accordo attivo. Scrivi a info@interfluid.net o al tuo commerciale.</p>
          <form action={esci}><button className="btn ghost" type="submit">Esci</button></form>
        </div>
      </main>
    );
  }

  await registra("accesso");
  const [a] = area.accordi;

  return (
    <>
      <header className="top">
        <div className="wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/interfluid-logo.svg" alt="Interfluid — Your Fluid Mate" />
          <div className="who">
            <b>{area.ragioneSociale}</b>
            <span>{area.nome ? `${area.nome} · ` : ""}{area.email}</span>
            <form action={esci}><button className="linkbtn" type="submit">Esci</button></form>
          </div>
        </div>
      </header>
      <main>
        <div className="wrap">
          <div className="intro-blk">
            <div className="eyebrow">Oleodinamica · Banco Digitale</div>
            {a ? (
              <>
                <h1>Accordo quadro <span>{a.brand === "MARZOCCHI" ? "Marzocchi Pompe" : a.brand} {a.anno}</span></h1>
                <p>I prezzi netti del vostro accordo, la disponibilità a Gallarate e quanto manca al bonus di fine anno. IVA esclusa.</p>
              </>
            ) : (
              <>
                <h1>Nessun accordo <span>attivo</span></h1>
                <p>Al momento non ci sono accordi attivi per la vostra azienda. Per informazioni scrivete a info@interfluid.net.</p>
              </>
            )}
          </div>
          {a && <AreaAccordo a={a} />}
        </div>
      </main>
      <footer>
        <div className="wrap">
          <span><b>Interfluid S.r.l.</b> · Via Lazzaretto 10/F, Gallarate (VA) · info@interfluid.net</span>
          <span className="tag">YOUR FLUID MATE</span>
        </div>
      </footer>
    </>
  );
}
