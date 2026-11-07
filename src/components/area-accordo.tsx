"use client";

import { useMemo, useState } from "react";

import type { Accordo, Riga } from "@/lib/area";
import { data, euro, numero, proiezione } from "@/lib/formato";

const chiave = (s: string) => s.toUpperCase().replace(/[\s\-_/]+/g, "").replace(/,/g, ".");

type Letta = { codice: string; q: number; r?: Riga };

function leggi(testo: string, indice: Map<string, Riga>): Letta[] {
  return testo.split(/[\n;\t]+/).map((x) => x.trim()).filter((x) => x.length >= 2).map((riga) => {
    let codice = riga, q = 1;
    if (!indice.has(chiave(riga))) {
      const m = riga.match(/^(.*\S)\s+(\d{1,5})$/);
      if (m) { codice = m[1]; q = Number(m[2]); }
    }
    return { codice, q, r: indice.get(chiave(codice)) };
  });
}

const Disp = ({ si }: { si: boolean }) =>
  si ? <span className="pill ok">A magazzino</span> : <span className="pill wait">Da ordinare</span>;

export function AreaAccordo({ a }: { a: Accordo }) {
  const indice = useMemo(() => new Map(a.listino.map((r) => [chiave(r.codice), r])), [a.listino]);
  const serie = useMemo(() => [...new Set(a.listino.map((r) => r.serie ?? "–"))].sort(), [a.listino]);
  const [testo, setTesto] = useState("");
  const [righe, setRighe] = useState<Letta[]>([]);
  const [cerca, setCerca] = useState("");
  const [fs, setFs] = useState("");
  const [fd, setFd] = useState("");

  const prezzate = righe.filter((x) => x.r);
  const totale = prezzate.reduce((s, x) => s + x.r!.prezzo * x.q, 0);
  const mancanti = righe.length - prezzate.length;

  const fatt = a.fatturato ?? 0;
  const pct = (v: number) => Math.min(100, (v / a.soglia) * 100);
  const manca = Math.max(0, a.soglia - fatt - totale);
  const proj = a.fatturato != null && a.fatturatoAl ? proiezione(a.fatturato, a.fatturatoAl, a.anno) : null;

  const q = chiave(cerca);
  const visibili = a.listino.filter((r) => (!q || chiave(r.codice).includes(q)) && (!fs || (r.serie ?? "–") === fs) && (fd === "" || String(r.magazzino ? 1 : 0) === fd));

  function aggiungi(codice: string) {
    const t = (testo.trim() ? testo.trim() + "\n" : "") + codice + " 1";
    setTesto(t);
    setRighe(leggi(t, indice));
  }

  return (
    <>
      <section className="bonus" aria-labelledby="bonusT">
        <div className="bonus-in">
          <div>
            <h2 id="bonusT">Fatturato {a.brand.toLowerCase().replace(/^./, (c) => c.toUpperCase())} {a.anno} con Interfluid</h2>
            <div className="big num">
              {a.fatturato == null ? "–" : euro(fatt)}
              {totale > 0 && <small> + {euro(totale)} con questa lista</small>}
            </div>
            <div className="bar" role="img" aria-label={`Fatturato ${euro(fatt)} su soglia ${euro(a.soglia)}`}>
              <div className="fill" style={{ width: pct(fatt) + "%" }} />
              <div className="add" style={{ left: pct(fatt) + "%", width: Math.max(0, pct(fatt + totale) - pct(fatt)) + "%" }} />
            </div>
            <div className="scale num"><span>€ 0</span><span>soglia {euro(a.soglia)}</span></div>
          </div>
          <div className="facts">
            <div className="fact"><div className="l">Mancano al bonus</div><div className="v o num">{manca > 0 ? euro(manca) : "Soglia raggiunta"}</div></div>
            <div className="fact"><div className="l">Bonus a soglia raggiunta</div><div className="v num">{euro((Math.max(a.soglia, fatt + totale) * a.bonusPct) / 100)}</div></div>
            <div className="fact"><div className="l">Al ritmo attuale, a fine anno</div><div className="v num">{proj == null ? "–" : euro(proj)}</div></div>
            <div className="fact"><div className="l">Bonus</div><div className="v num">{numero(a.bonusPct, 0)}% da {euro(a.soglia)}</div></div>
          </div>
          <div className="note">
            {a.fatturato == null
              ? "Il fatturato dell'anno compare dalla prima fattura dell'accordo."
              : `Fatture meno note di credito dal ${data(a.validoDal)}, aggiornato al ${data(a.fatturatoAl)}. Il bonus viene riconosciuto con nota di credito entro il 31 gennaio dell'anno successivo: fa fede quella.`}
          </div>
        </div>
      </section>

      <section className="blk" aria-labelledby="calcT">
        <h3 id="calcT">Prezzi per la tua lista</h3>
        <p className="sub">Incolla i codici, uno per riga, con la quantità dopo il codice se vuoi (per esempio «ALP2-D-20 4»). Vedi prezzo netto, disponibilità e quanto la lista ti avvicina al bonus.</p>
        <div className="work">
          <div className="paste">
            <label htmlFor="lista">Codici e quantità</label>
            <textarea id="lista" spellCheck={false} value={testo} onChange={(e) => setTesto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) setRighe(leggi(testo, indice)); }}
              placeholder={"ALP2-D-20 4\nGHP2-D-13 2"} />
            <div className="row-btn">
              <button type="button" className="btn" onClick={() => setRighe(leggi(testo, indice))}>Mostra i prezzi</button>
              <button type="button" className="btn ghost" onClick={() => { setTesto(""); setRighe([]); }}>Svuota</button>
            </div>
            <div className="hint">Puoi incollare direttamente da Excel o da un ordine. I codici fuori dal tuo listino li quota il tuo commerciale entro 24 ore lavorative.</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="tbox">
              <table>
                <thead><tr><th>Codice</th><th className="hide-s">Serie</th><th className="r">Q.tà</th><th className="r">Prezzo netto €</th><th className="r">Totale €</th><th>Disponibilità</th></tr></thead>
                <tbody>
                  {righe.length === 0 && <tr><td colSpan={6} className="empty">Incolla almeno un codice e premi «Mostra i prezzi».</td></tr>}
                  {righe.map((x, i) => x.r ? (
                    <tr key={i}><td className="code">{x.r.codice}</td><td className="hide-s">{x.r.serie ?? "–"}</td><td className="r num">{x.q}</td>
                      <td className="r num">{numero(x.r.prezzo)}</td><td className="r num">{numero(x.r.prezzo * x.q)}</td><td><Disp si={x.r.magazzino} /></td></tr>
                  ) : (
                    <tr key={i} className="miss"><td className="code">{x.codice}</td><td className="hide-s">–</td><td className="r num">{x.q}</td>
                      <td colSpan={2} className="r">Non nel tuo listino</td><td><span className="pill wait">Quotazione entro 24 h</span></td></tr>
                  ))}
                </tbody>
                {prezzate.length > 0 && (
                  <tfoot><tr><td colSpan={4}>Totale {prezzate.length} {prezzate.length === 1 ? "riga" : "righe"} a listino</td><td className="r num">{numero(totale)}</td><td /></tr></tfoot>
                )}
              </table>
            </div>
            {prezzate.length > 0 && (
              <div className="after">
                <span>Con questa lista il fatturato {a.anno} sale a <span className="k num">{euro(fatt + totale)}</span>.</span>
                {manca > 0 ? <span>Al bonus mancano <span className="k o num">{euro(manca)}</span>.</span> : <span className="k o">Con questa lista raggiungi la soglia del bonus.</span>}
                {mancanti > 0 && <span>{mancanti} {mancanti === 1 ? "codice" : "codici"} da quotare a parte.</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="blk" aria-labelledby="listT">
        <h3 id="listT">Il tuo listino completo</h3>
        <p className="sub">Prezzi netti per pezzo, IVA esclusa, uguali per codici a magazzino e da ordinare. Validi dal {data(a.validoDal)} al {data(a.validoAl)}{a.disponibilitaAl ? `. Disponibilità al ${data(a.disponibilitaAl)}` : ""}.</p>
        <div className="tools">
          <input type="search" aria-label="Cerca nel listino" placeholder="Cerca un codice, per esempio GHP2" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          <select aria-label="Serie" value={fs} onChange={(e) => setFs(e.target.value)}><option value="">Tutte le serie</option>{serie.map((s) => <option key={s}>{s}</option>)}</select>
          <select aria-label="Disponibilità" value={fd} onChange={(e) => setFd(e.target.value)}><option value="">Tutti</option><option value="1">A magazzino</option><option value="0">Da ordinare</option></select>
          <a className="btn ghost" href={`/listino.xlsx?accordo=${a.id}`}>Scarica il listino (Excel)</a>
          <span className="count num">{visibili.length} di {a.listino.length} codici</span>
        </div>
        <div className="tbox scroll">
          <table>
            <thead><tr><th>Codice</th><th>Serie</th><th className="r">Prezzo netto €</th><th>Disponibilità</th><th className="hide-s" /></tr></thead>
            <tbody>
              {visibili.length === 0 && <tr><td colSpan={5} className="empty">Nessun codice trovato. Prova con una parte del codice, per esempio «ALP2».</td></tr>}
              {visibili.map((r) => (
                <tr key={r.codice}><td className="code">{r.codice}</td><td>{r.serie ?? "–"}</td><td className="r num">{numero(r.prezzo)}</td><td><Disp si={r.magazzino} /></td>
                  <td className="hide-s"><button type="button" className="btn ghost small" onClick={() => aggiungi(r.codice)}>Aggiungi alla lista</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
