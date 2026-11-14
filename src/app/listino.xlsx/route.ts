import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { caricaArea, registra } from "@/lib/area";

// Catalogo del cliente in Excel, generato sul momento con i dati del cliente collegato.
export async function GET() {
  const area = await caricaArea();
  if (area === "non_abilitato") return new NextResponse("Accesso non abilitato", { status: 403 });
  const voci = area.catalogo;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Interfluid S.r.l.";
  wb.title = `Prezzi netti riservati – ${area.ragioneSociale}`;
  const ws = wb.addWorksheet("Catalogo", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  ws.columns = [{ width: 32 }, { width: 44 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 18 }];
  ws.getCell("A1").value = `Prezzi netti riservati · ${area.ragioneSociale}`;
  ws.getCell("A1").font = { size: 15, bold: true, color: { argb: "FF191C1F" } };
  const agg = area.aggiornatoIl ? new Date(area.aggiornatoIl).toLocaleDateString("it-IT") : null;
  const gd = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("it-IT") : "–");
  ws.getCell("A2").value = `Prezzi netti per pezzo in € (IVA esclusa)${agg ? ` · prezzi aggiornati al ${agg}` : ""} · pezzi pronti: Interfluid al ${gd(area.giacenzeAl.interfluid)}, Hydraut al ${gd(area.giacenzeAl.hydraut)} · la disponibilità cambia ogni giorno`;
  ws.getCell("A3").value = `Documento riservato a ${area.ragioneSociale}: non comunicare a terzi. Scaricato il ${new Date().toLocaleDateString("it-IT")}.`;
  ws.getCell("A3").font = { size: 9, italic: true, color: { argb: "FF5F6C72" } };
  const h = ws.getRow(5);
  h.values = ["Codice", "Descrizione", "Brand", "Prezzo netto €", "Disponibilità", "Pezzi pronti", "di cui Interfluid", "di cui Hydraut"];
  h.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF191C1F" } }; });
  voci.forEach((v, i) => {
    const disp = v.modalita === "su_ordine" ? "Su ordine" : v.disponibilita === "disponibile" ? "Pronta" : v.disponibilita === "da_ordinare" ? "Da ordinare" : "";
    const row = ws.addRow([v.codice, v.descrizione ?? v.serie ?? "", v.brand, v.prezzo ?? "Su richiesta", disp + (v.esaurimento ? " · fine serie" : ""), v.disponibile ?? "", v.dispInterfluid ?? "", v.dispHydraut ?? ""]);
    row.getCell(4).numFmt = "#,##0.00";
    if (i % 2) row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F5" } }; });
  });
  ws.autoFilter = { from: "A5", to: `H${5 + voci.length}` };

  await registra("scarica_excel");
  const buf = await wb.xlsx.writeBuffer();
  const nome = `Prezzi_Interfluid_${area.cliente}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
