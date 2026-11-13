"use client";

import { useTransition } from "react";

import { cambiaCliente } from "./azioni";

/** Menu per gli utenti Interfluid: vedere il Banco come uno dei clienti abilitati alla simulazione. */
export function SceltaCliente({ attuale, clienti }: { attuale: string; clienti: { codice: string; ragioneSociale: string }[] }) {
  const [inCorso, avvia] = useTransition();
  return (
    <label className="scelta-cli">
      <span>Vedi come</span>
      <select
        value={attuale}
        disabled={inCorso}
        onChange={(e) => { const f = new FormData(); f.set("cliente", e.target.value); avvia(() => cambiaCliente(f)); }}
      >
        {clienti.map((c) => <option key={c.codice} value={c.codice}>{c.ragioneSociale}</option>)}
      </select>
    </label>
  );
}
