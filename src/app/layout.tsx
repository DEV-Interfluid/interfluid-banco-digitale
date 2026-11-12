import type { Metadata } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";

import "./globals.css";

const urbanist = Urbanist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Banco · Interfluid",
  description: "Prezzi netti riservati, disponibilità e richieste d'ordine per i clienti Interfluid",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={mono.variable}>
      <body className={urbanist.className}>{children}</body>
    </html>
  );
}
