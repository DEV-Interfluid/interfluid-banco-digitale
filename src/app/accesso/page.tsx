import { ModuloAccesso } from "./modulo";

export const metadata = { title: "Accesso · Banco Interfluid" };

const ERRORI: Record<string, string> = {
  link: "Il link non è più valido o è già stato usato. Chiedine uno nuovo.",
};

export default async function Accesso({ searchParams }: { searchParams: Promise<{ errore?: string }> }) {
  const { errore } = await searchParams;
  return (
    <main className="accesso">
      <div className="scheda">
        <span className="marchio">
          <span className="anello" aria-hidden="true" />
          <span className="nome">Banco</span>
          <span className="di">Interfluid</span>
        </span>
        <h1>Accedi al tuo banco</h1>
        <p className="intro">Prezzi netti riservati, disponibilità a Gallarate e richieste d&apos;ordine, in un solo posto.</p>
        <ModuloAccesso errore={errore ? ERRORI[errore] ?? ERRORI.link : undefined} />
      </div>
    </main>
  );
}
