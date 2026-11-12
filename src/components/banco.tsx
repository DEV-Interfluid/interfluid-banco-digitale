"use client";

import { useMemo, useState, useTransition } from "react";

import { inviaRichiesta } from "@/app/azioni";
import type { Accordo, Richiesta, Voce } from "@/lib/area";
import { data, euro, numero, proiezione } from "@/lib/formato";

const chiave = (s: string) => s.toUpperCase().replace(/[\s\-_/.]+/g, "").replace(/,/g, "");

type Riga = { testo: string; q: number; v?: Voce };

/** Legge una lista incollata: un codice per riga, quantità facoltativa dopo il codice. */
function leggi(testo: string, indice: Map<string, Voce>): Riga[] {
  return testo.split(/[\n;\t]+/).map((x) => x.trim()).filter((x) => x.length >= 2).map((riga) => {
    let codice = riga, q = 1;
    if (!indice.has(chiave(riga))) {
      const m = riga.match(/^(.*\S)\s+(\d{1,5})$/);
      if (m) { codice = m[1]; q = Number(m[2]); }
    }
    return { testo: codice, q, v: indice.get(chiave(codice)) };
  });
}

function Disp({ v, q = 1 }: { v: Voce; q?: number }) {
  if (v.modalita === "su_ordine") return <span className="pill blu">Su ordine</span>;
  if (v.disponibilita === "disponibile") {
    const parziale = v.disponibile != null && v.disponibile < q;
    return <span className={parziale ? "pill amb" : "pill ok"}>{v.disponibile != null ? `${numero(v.disponibile, 0)} pz pronti` : "Pronta"}</span>;
  }
  if (v.disponibilita === "da_ordinare") return <span className="pill amb">Da ordinare</span>;
  return <span className="pill">–</span>;
}

const Prezzo = ({ v }: { v: Voce }) => (v.prezzo == null ? <span className="muto">Su richiesta</span> : <>{numero(v.prezzo)}</>);

export function Banco({ catalogo, accordo, richieste, aggiornatoIl }: { catalogo: Voce[]; accordo: Accordo | null; richieste: Richiesta[]; aggiornatoIl: string | null }) {
  const indice = useMemo(() => new Map(catalogo.map((v) => [chiave(v.codice), v])), [catalogo]);
  const brandList = useMemo(() => [...new Set(catalogo.map((v) => v.brand))].sort(), [catalogo]);

  const [testo, setTesto] = useState("");
  const [righe, setRighe] = useState<Riga[]>([]);
  const [rif, setRif] = useState("");
  const [note, setNote] = useState("");
  const [esito, setEsito] = useState<{ ok: boolean; msg: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  const [cerca, setCerca] = useState("");
  const [fb, setFb] = useState("");
  const [soloPronti, setSoloPronti] = useState(false);

  const prezzate = righe.filter((r) => r.v && r.v.prezzo != null);
  const totale = prezzate.reduce((s, r) => s + r.v!.prezzo! * r.q, 0);
  const daQuotare = righe.length - prezzate.length;

  const q = chiave(cerca);
  const visibili = catalogo.filter((v) =>
    (!q || chiave(v.codice).includes(q) || (v.descrizione ?? "").toUpperCase().includes(cerca.trim().toUpperCase())) &&
    (!fb || v.brand === fb) && (!soloPronti || v.disponibilita === "disponibile"));
  const mostrati = visibili.slice(0, 300);

  function analizza(t = testo) { setRighe(leggi(t, indice)); setEsito(null); }
  function aggiungi(codice: string) {
    const t = (testo.trim() ? testo.trim() + "\n" : "") + codice + " 1";
    setTesto(t); analizza(t);
    document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cambiaQ(i: number, n: number) {
    setRighe((rr) => rr.map((r, j) => (j === i ? { ...r, q: Math.max(1, n || 1) } : r)));
  }
  function togli(i: number) { setRighe((rr) => rr.filter((_, j) => j !== i)); }
  function invia() {
    avvia(async () => {
      const r = await inviaRichiesta(righe.map((x) => ({ codice: x.v?.codice ?? x.testo, qta: x.q })), rif, note);
      if (r.errore) setEsito({ ok: false, msg: r.errore });
      else { setEsito({ ok: true, msg: `Richiesta n. ${r.id} inviata. Il tuo commerciale la conferma e ti risponde con disponibilità e consegna.` }); setRighe([]); setTesto(""); setRif(""); setNote(""); }
    });
  }

  return (
    <>
      <section className="card lista" aria-labelledby="listaT">
        <div className="lista-in">
          <label id="listaT" htmlFor="lista" className="h2">Incolla una lista o una distinta</label>
          <textarea id="lista" rows={6} spellCheck={false} value={testo} onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analizza(); }}
            placeholder={"HD-4WE6J61B/CG24N9K4   10\n45DFLR3RPA12N00   2"} />
          <span className="aiuto">Un codice per riga, con la quantità dopo il codice se vuoi. Puoi incollare da Excel o da un ordine.</span>
        </div>
        <div className="lista-az">
          <label htmlFor="rif" className="etichetta">Tuo riferimento (facoltativo)</label>
          <input id="rif" type="text" maxLength={120} placeholder="Es. commessa o cliente" value={rif} onChange={(e) => setRif(e.target.value)} />
          <button type="button" className="btn oro" onClick={() => analizza()}>Analizza {testo.trim() ? testo.trim().split(/\n+/).length : ""} righe</button>
          <button type="button" className="btn ghost" onClick={() => { setTesto(""); setRighe([]); setEsito(null); }}>Svuota</button>
        </div>
      </section>

      {esito && <div className={esito.ok ? "avviso ok" : "avviso err"} role="status">{esito.msg}</div>}

      {righe.length > 0 && (
        <section className="card" aria-labelledby="risT">
          <div className="card-h"><h2 id="risT">La tua lista</h2><span className="muto">{righe.length} righe · prezzi netti per pezzo, IVA esclusa</span></div>
          <div className="tbox">
            <table>
              <thead><tr><th>Codice</th><th className="hide-s">Descrizione</th><th className="r">Q.tà</th><th className="r">Prezzo €</th><th className="r">Totale €</th><th>Disponibilità</th><th /></tr></thead>
              <tbody>
                {righe.map((r, i) => (
                  <tr key={i} className={r.v ? "" : "miss"}>
                    <td className="code">{r.v?.codice ?? r.testo}</td>
                    <td className="hide-s">{r.v ? (r.v.descrizione ?? r.v.serie ?? r.v.brand) : "Non nel tuo catalogo: lo quota il commerciale"}</td>
                    <td className="r"><input className="qta" type="number" min={1} aria-label={`Quantità ${r.testo}`} value={r.q} onChange={(e) => cambiaQ(i, Number(e.target.value))} /></td>
                    <td className="r num">{r.v ? <Prezzo v={r.v} /> : "–"}</td>
                    <td className="r num">{r.v?.prezzo != null ? numero(r.v.prezzo * r.q) : "–"}</td>
                    <td>{r.v ? <Disp v={r.v} q={r.q} /> : <span className="pill amb">Da quotare</span>}{r.v?.esaurimento && <span className="pill">Fine serie</span>}</td>
                    <td><button type="button" className="linkbtn" aria-label={`Togli ${r.testo}`} onClick={() => togli(i)}>Togli</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>Totale {prezzate.length} {prezzate.length === 1 ? "riga" : "righe"} con prezzo{daQuotare > 0 ? ` · ${daQuotare} da quotare` : ""}</td><td className="r num">{numero(totale)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
          <div className="invio">
            <div className="invio-note">
              <label htmlFor="note" className="etichetta">Note per il commerciale (facoltative)</label>
              <textarea id="note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. spedizione diretta al mio cliente, consegna unica" />
            </div>
            <div className="invio-az">
              <button type="button" className="btn oro" disabled={inCorso} onClick={invia}>{inCorso ? "Invio…" : "Invia richiesta d'ordine"}</button>
              <span className="aiuto">Non è ancora un ordine: il tuo commerciale lo conferma con disponibilità e data di consegna.</span>
            </div>
          </div>
        </section>
      )}

      <div className="griglia">
        {accordo && <Bonus a={accordo} totaleLista={righe.length ? totale : 0} />}
        <section className="card pannello" aria-labelledby="ricT">
          <div className="card-h"><h2 id="ricT">Richieste inviate</h2></div>
          {richieste.length === 0 && <p className="vuoto">Nessuna richiesta finora. Incolla una lista e premi «Invia richiesta d&apos;ordine».</p>}
          {richieste.map((r) => (
            <div key={r.id} className="riga-p">
              <span className={`pallino ${r.stato === "confermata" ? "verde" : r.stato === "annullata" ? "rosso" : "blu"}`} aria-hidden="true" />
              <div className="riga-t">
                <span className="code">Richiesta {r.id}{r.riferimento ? ` · ${r.riferimento}` : ""}</span>
                <span className="muto">{data(r.creata)} · {r.righe} {r.righe === 1 ? "riga" : "righe"} · {r.stato === "inviata" ? "in attesa di conferma" : r.stato}</span>
              </div>
              <span className="num">{r.totale != null ? euro(r.totale) : "–"}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card" aria-labelledby="catT">
        <div className="card-h"><h2 id="catT">Il tuo catalogo</h2><span className="muto">{catalogo.length} codici{aggiornatoIl ? ` · prezzi e disponibilità aggiornati al ${data(aggiornatoIl)}` : ""}</span></div>
        <div className="tools">
          <input type="search" aria-label="Cerca nel catalogo" placeholder="Cerca un codice o una descrizione" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          {brandList.length > 1 && (
            <select aria-label="Brand" value={fb} onChange={(e) => setFb(e.target.value)}><option value="">Tutti i brand</option>{brandList.map((b) => <option key={b}>{b}</option>)}</select>
          )}
          <label className="check"><input type="checkbox" checked={soloPronti} onChange={(e) => setSoloPronti(e.target.checked)} /> Solo pronti</label>
          <a className="btn ghost" href="/listino.xlsx">Scarica in Excel</a>
          <span className="muto num">{visibili.length} codici{visibili.length > mostrati.length ? `, primi ${mostrati.length}` : ""}</span>
        </div>
        <div className="tbox scroll">
          <table>
            <thead><tr><th>Codice</th><th className="hide-s">Descrizione</th><th className="r">Prezzo €</th><th>Disponibilità</th><th /></tr></thead>
            <tbody>
              {mostrati.length === 0 && <tr><td colSpan={5} className="vuoto">Nessun codice trovato. Prova con una parte del codice.</td></tr>}
              {mostrati.map((v) => (
                <tr key={v.codice}>
                  <td className="code">{v.codice}</td>
                  <td className="hide-s">{v.descrizione ?? v.serie ?? v.brand}</td>
                  <td className="r num"><Prezzo v={v} /></td>
                  <td><Disp v={v} />{v.esaurimento && <span className="pill">Fine serie</span>}</td>
                  <td className="r"><button type="button" className="btn ghost piccolo" onClick={() => aggiungi(v.codice)}>Aggiungi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Bonus({ a, totaleLista }: { a: Accordo; totaleLista: number }) {
  const fatt = a.fatturato ?? 0;
  const pct = (v: number) => Math.min(100, (v / a.soglia) * 100);
  const manca = Math.max(0, a.soglia - fatt - totaleLista);
  const proj = a.fatturato != null && a.fatturatoAl ? proiezione(a.fatturato, a.fatturatoAl, a.anno) : null;
  const nome = a.brand === "MARZOCCHI" ? "Marzocchi" : a.brand;
  return (
    <section className="card bonus" aria-labelledby="bonusT">
      <div className="card-h"><h2 id="bonusT">Accordo {nome} {a.anno}</h2><span className="muto">dal {data(a.validoDal)} al {data(a.validoAl)}</span></div>
      <div className="big num">{a.fatturato == null ? "–" : euro(fatt)}{totaleLista > 0 && <small> + {euro(totaleLista)} con questa lista</small>}</div>
      <div className="bar" role="img" aria-label={`Fatturato ${euro(fatt)} su soglia ${euro(a.soglia)}`}>
        <div className="fill" style={{ width: pct(fatt) + "%" }} />
        <div className="add" style={{ left: pct(fatt) + "%", width: Math.max(0, pct(fatt + totaleLista) - pct(fatt)) + "%" }} />
      </div>
      <div className="scale num"><span>€ 0</span><span>soglia {euro(a.soglia)}</span></div>
      <div className="facts">
        <div><span className="l">Mancano al bonus</span><b className="num">{manca > 0 ? euro(manca) : "Soglia raggiunta"}</b></div>
        <div><span className="l">Bonus</span><b className="num">{numero(a.bonusPct, 0)}% · {euro((Math.max(a.soglia, fatt + totaleLista) * a.bonusPct) / 100)}</b></div>
        <div><span className="l">Al ritmo attuale a fine anno</span><b className="num">{proj == null ? "–" : euro(proj)}</b></div>
      </div>
      <p className="nota-b">
        {a.fatturato == null
          ? "Il fatturato compare dalla prima fattura dell'accordo."
          : `Fatture meno note di credito, aggiornato al ${data(a.fatturatoAl)}. Il bonus si riconosce con nota di credito entro il 31 gennaio dell'anno successivo.`}
      </p>
    </section>
  );
}
