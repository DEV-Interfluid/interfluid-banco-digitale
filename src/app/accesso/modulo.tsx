"use client";

import { useActionState } from "react";

import { inviaLink, verificaCodice, type StatoAccesso } from "./azioni";

const iniziale: StatoAccesso = { inviato: false, errore: null };

export function ModuloAccesso({ errore }: { errore?: string }) {
  const [stato, azione, inCorso] = useActionState(inviaLink, iniziale);
  const [statoCodice, azioneCodice, verificando] = useActionState(verificaCodice, iniziale);
  const email = statoCodice.email ?? stato.email ?? "";
  if (stato.inviato) {
    return (
      <form action={azioneCodice} className="modulo">
        <div className="avviso ok" role="status">
          <b>Controlla la tua casella.</b> Se l&apos;indirizzo è abilitato, ti abbiamo inviato un codice di 6 cifre. Vale un&apos;ora.
        </div>
        <input type="hidden" name="email" value={email} />
        <label htmlFor="codice">Codice ricevuto per email</label>
        <input id="codice" name="codice" className="codice" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" maxLength={12} required autoFocus placeholder="123456" />
        {statoCodice.errore && <div className="errore" role="alert">{statoCodice.errore}</div>}
        <button className="btn" type="submit" disabled={verificando}>{verificando ? "Verifica in corso…" : "Entra"}</button>
        <p className="nota">Non è arrivato? Controlla la posta indesiderata, oppure <a href="/accesso">chiedine uno nuovo</a>.</p>
      </form>
    );
  }
  return (
    <form action={azione} className="modulo">
      {errore && <div className="avviso" role="alert">{errore}</div>}
      <label htmlFor="email">Email aziendale</label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="nome@azienda.it" />
      {stato.errore && <div className="errore" role="alert">{stato.errore}</div>}
      <button className="btn" type="submit" disabled={inCorso}>{inCorso ? "Invio in corso…" : "Inviami il codice di accesso"}</button>
      <p className="nota">Niente password: ricevi un codice via email. L&apos;accesso è riservato ai clienti con un accordo Interfluid.</p>
    </form>
  );
}
