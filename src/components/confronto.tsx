"use client";

import { useEffect, useRef } from "react";

import type { Confronto, DatiPompa, Voce } from "@/lib/area";
import { numero } from "@/lib/formato";

/** Etichetta breve del verdetto del comparatore. */
export function Verdetto({ c }: { c: Confronto }) {
  const drop = c.verdetto === "DROP-IN";
  return <span className={drop ? "pill ok" : "pill amb"} title={drop ? "Si monta al posto della pompa attuale senza modifiche" : "Si monta con adattamenti meccanici o idraulici"}>{drop ? "Drop-in" : "Con adattamenti"}</span>;
}

type Riga = { etichetta: string; unita?: string; chiave: keyof DatiPompa; numero?: boolean };
const RIGHE: Riga[] = [
  { etichetta: "Cilindrata", unita: "cm³/giro", chiave: "cilindrata", numero: true },
  { etichetta: "Pressione nominale", unita: "bar", chiave: "p_nom", numero: true },
  { etichetta: "Pressione di picco", unita: "bar", chiave: "p_picco", numero: true },
  { etichetta: "Regime massimo", unita: "giri/min", chiave: "rpm_max", numero: true },
  { etichetta: "Rotazione", chiave: "rotazione" },
  { etichetta: "Flangia", chiave: "flangia" },
  { etichetta: "Albero", chiave: "albero" },
  { etichetta: "Sporgenza albero L1", unita: "mm", chiave: "l1", numero: true },
  { etichetta: "Posizione porte", chiave: "porte" },
  { etichetta: "Aspirazione", chiave: "aspirazione" },
  { etichetta: "Mandata", chiave: "mandata" },
  { etichetta: "Guarnizioni", chiave: "guarnizioni" },
];

const val = (d: DatiPompa, r: Riga) => {
  const x = d[r.chiave];
  if (x == null || x === "") return null;
  return r.numero ? numero(Number(x), Number(x) % 1 ? 1 : 0) : String(x);
};
const sn = (x?: string) => (x ?? "").toLowerCase();

/** Pannello di confronto tecnico: la pompa del cliente accanto alla nostra, differenze evidenziate. */
export function PannelloConfronto({ v, c, onChiudi }: { v: Voce; c: Confronto; onChiudi: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    document.addEventListener("keydown", esc);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [onChiudi]);

  const a = c.adattamenti ?? {};
  const serve: string[] = [];
  if (sn(a.lanterna).startsWith("s")) serve.push("Lanterna di accoppiamento diversa");
  if (sn(a.semigiunto).startsWith("s")) serve.push("Semigiunto lato pompa diverso");
  if (a.aspirazione && sn(a.aspirazione) !== "nessuno") serve.push(`Aspirazione: ${a.aspirazione}`);
  if (a.mandata && sn(a.mandata) !== "nessuno") serve.push(`Mandata: ${a.mandata}`);
  const kit = sn(a.lanterna).startsWith("s") || sn(a.semigiunto).startsWith("s");
  const rotDiversa = c.cliente.rotazione && c.nostra.rotazione && sn(c.cliente.rotazione) !== sn(c.nostra.rotazione);

  return (
    <div className="ov" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div className="pannello-c" role="dialog" aria-modal="true" aria-labelledby="confT" tabIndex={-1} ref={ref}>
        <div className="pc-h">
          <div>
            <h2 id="confT">Confronto tecnico</h2>
            <span className="muto">Coppia verificata dal nostro ufficio tecnico</span>
          </div>
          <button type="button" className="btn ghost piccolo" onClick={onChiudi}>Chiudi</button>
        </div>
        <div className="pc-esito"><Verdetto c={c} /><span>{c.verdetto === "DROP-IN" ? "Si monta al posto della pompa attuale senza modifiche." : "Si monta con gli adattamenti indicati sotto."}</span></div>
        <div className="tbox">
          <table className="t-conf">
            <thead>
              <tr><th /><th>La tua pompa<span className="code">{c.modello}</span><span className="muto">{c.brand.charAt(0) + c.brand.slice(1).toLowerCase()}</span></th>
                <th>Proposta<span className="code">{v.codice}</span><span className="muto">{v.brand.charAt(0) + v.brand.slice(1).toLowerCase()}</span></th></tr>
            </thead>
            <tbody>
              {RIGHE.map((r) => {
                const x = val(c.cliente, r), y = val(c.nostra, r);
                if (x == null && y == null) return null;
                const diverso = x != null && y != null && x !== y;
                return (
                  <tr key={r.chiave} className={diverso ? "diff" : ""}>
                    <td className="lbl">{r.etichetta}{r.unita && <small> {r.unita}</small>}</td>
                    <td className="num">{x ?? "–"}</td>
                    <td className="num">{y ?? "–"}{diverso && <span className="diff-m" aria-label="diverso">≠</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pc-serve">
          <h3>Cosa serve per montarla</h3>
          {serve.length === 0 && !rotDiversa ? <p>Nulla: stessi attacchi e stesso accoppiamento.</p> : (
            <ul>
              {serve.map((s) => <li key={s}>{s}</li>)}
              {rotDiversa && <li>Rotazione diversa{a.puo_invertire_rotazione ? ": la pompa proposta si può invertire" : ""}</li>}
            </ul>
          )}
          {(c.avvisi ?? []).length > 0 && <ul className="avvisi">{c.avvisi.map((s) => <li key={s}>{s}</li>)}</ul>}
          {kit && <p className="muto">Il kit di adattamento dipende dal motore: lo quota il tuo commerciale insieme alla pompa.</p>}
        </div>
      </div>
    </div>
  );
}
