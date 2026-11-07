const gruppi = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** 1234.5 → "1.234,50" (separatori italiani anche sotto le 10.000). */
export function numero(v: number, decimali = 2): string {
  const [i, f] = Math.abs(v).toFixed(decimali).split(".");
  return (v < 0 ? "−" : "") + gruppi(i) + (f ? "," + f : "");
}
export const euro = (v: number) => "€ " + numero(Math.round(v), 0);
export function data(iso: string | null): string {
  if (!iso) return "–";
  const [a, m, g] = iso.slice(0, 10).split("-");
  return `${Number(g)}/${Number(m)}/${a}`;
}
/** Proiezione a fine anno al ritmo attuale; null se l'anno dell'accordo non è iniziato. */
export function proiezione(importo: number, al: string, anno: number): number | null {
  const inizio = Date.UTC(anno, 0, 1), fine = Date.UTC(anno, 11, 31), oggi = Date.parse(al + "T00:00:00Z");
  if (!(oggi >= inizio)) return null;
  const giorni = Math.min(oggi, fine) - inizio;
  return giorni <= 0 ? null : (importo / (giorni / 864e5 + 1)) * 365;
}
