import { Banco } from "@/components/banco";
import { caricaArea, registra } from "@/lib/area";

import { esci } from "./accesso/azioni";

function saluto() {
  const h = Number(new Intl.DateTimeFormat("it-IT", { hour: "numeric", hour12: false, timeZone: "Europe/Rome" }).format(new Date()));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

function Marchio() {
  return (
    <span className="marchio">
      <span className="anello" aria-hidden="true" />
      <span className="nome">Banco</span>
      <span className="di">Interfluid</span>
    </span>
  );
}

export default async function Home() {
  const area = await caricaArea();

  if (area === "non_abilitato") {
    return (
      <main className="accesso">
        <div className="scheda">
          <Marchio />
          <h1>Accesso non abilitato</h1>
          <p className="intro">Questo indirizzo non è collegato a nessun cliente attivo. Scrivi a info@interfluid.net o al tuo commerciale.</p>
          <form action={esci}><button className="btn ghost" type="submit">Esci</button></form>
        </div>
      </main>
    );
  }

  await registra("accesso");
  const oggi = new Date().toISOString().slice(0, 10);
  const accordo = area.accordi.find((a) => a.validoAl >= oggi) ?? area.accordi[0] ?? null;
  const nome = area.nome?.split(" ")[0];

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <Marchio />
          <div className="chi">
            <span><b>{area.ragioneSociale}</b>{area.nome ? ` · ${area.nome}` : ""}</span>
            <form action={esci}><button className="linkbtn chiaro" type="submit">Esci</button></form>
          </div>
        </div>
      </header>
      <main className="wrap principale">
        <div className="titolo">
          <h1>{saluto()}{nome ? `, ${nome}` : ""}. Da dove riprendi?</h1>
          <span className="muto">Prezzi netti riservati {area.ragioneSociale}, IVA esclusa</span>
        </div>
        <Banco catalogo={area.catalogo} accordo={accordo} richieste={area.richieste} aggiornatoIl={area.aggiornatoIl} />
      </main>
      <footer>
        <div className="wrap piede">
          <span><b>Interfluid S.r.l.</b> · Via Lazzaretto 10/F, Gallarate (VA) · info@interfluid.net</span>
          <span>Strumento riservato · non comunicare prezzi a terzi</span>
        </div>
      </footer>
    </>
  );
}
