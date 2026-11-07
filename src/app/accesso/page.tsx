import { ModuloAccesso } from "./modulo";

export const metadata = { title: "Accesso · Banco Digitale Interfluid" };

const ERRORI: Record<string, string> = {
  link: "Il link non è più valido o è già stato usato. Chiedine uno nuovo.",
};

export default async function Accesso({ searchParams }: { searchParams: Promise<{ errore?: string }> }) {
  const { errore } = await searchParams;
  return (
    <main className="accesso">
      <div className="scheda">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/interfluid-logo.svg" alt="Interfluid — Your Fluid Mate" className="logo" />
        <div className="eyebrow">Area riservata clienti</div>
        <h1>Banco <span>Digitale</span></h1>
        <p className="intro">I prezzi del vostro accordo, la disponibilità a Gallarate e l&apos;avanzamento verso il bonus di fine anno.</p>
        <ModuloAccesso errore={errore ? ERRORI[errore] ?? ERRORI.link : undefined} />
      </div>
    </main>
  );
}
