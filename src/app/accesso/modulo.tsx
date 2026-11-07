"use client";

import { useActionState } from "react";

import { inviaLink, type StatoAccesso } from "./azioni";

const iniziale: StatoAccesso = { inviato: false, errore: null };

export function ModuloAccesso({ errore }: { errore?: string }) {
  const [stato, azione, inCorso] = useActionState(inviaLink, iniziale);
  if (stato.inviato) {
    return (
      <div className="avviso ok" role="status">
        <b>Controlla la tua casella.</b> Se l&apos;indirizzo è abilitato, ti abbiamo inviato un link per entrare.
        Il link vale un&apos;ora e si usa una volta sola.
      </div>
    );
  }
  return (
    <form action={azione} className="modulo">
      {errore && <div className="avviso" role="alert">{errore}</div>}
      <label htmlFor="email">Email aziendale</label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="nome@azienda.it" />
      {stato.errore && <div className="errore" role="alert">{stato.errore}</div>}
      <button className="btn" type="submit" disabled={inCorso}>{inCorso ? "Invio in corso…" : "Inviami il link di accesso"}</button>
      <p className="nota">Niente password: ricevi un link via email. L&apos;accesso è riservato ai clienti con un accordo Interfluid.</p>
    </form>
  );
}
