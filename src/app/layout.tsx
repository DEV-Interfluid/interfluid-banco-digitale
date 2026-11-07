import type { Metadata } from "next";
import { Quicksand } from "next/font/google";

import "./globals.css";

const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "Banco Digitale · Interfluid",
  description: "Area riservata ai clienti Interfluid con accordo",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={quicksand.className}>{children}</body>
    </html>
  );
}
