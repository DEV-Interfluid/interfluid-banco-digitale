import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { caricaArea, registra } from "@/lib/area";

// Listino dell'accordo in Excel, generato sul momento con i dati del cliente collegato.
export async function GET(request: NextRequest) {
  const area = await caricaArea();
  if (area === "non_abilitato") return new NextResponse("Accesso non abilitato", { status: 403 });
  const id = Number(request.nextUrl.searchParams.get("accordo"));
  const a = area.accordi.find((x) => x.id === id) ?? area.accordi[0];
  if (!a) return new NextResponse("Nessun accordo", { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Interfluid S.r.l.";
  wb.title = `Listino netto riservato – ${area.ragioneSociale}`;
  const ws = wb.addWorksheet(`Listino ${a.anno}`, { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  ws.columns = [{ width: 34 }, { width: 20 }, { width: 18 }, { width: 18 }];
  ws.getCell("A1").value = `Listino netto riservato · ${area.ragioneSociale}`;
  ws.getCell("A1").font = { size: 15, bold: true, color: { argb: "FF2D3853" } };
  ws.getCell("A2").value = `Accordo quadro ${a.brand === "MARZOCCHI" ? "Marzocchi Pompe" : a.brand} ${a.anno} · prezzi netti per pezzo in € (IVA esclusa) · validi dal ${a.validoDal} al ${a.validoAl}`;
  ws.getCell("A3").value = `Documento riservato a ${area.ragioneSociale}: non comunicare a terzi. Scaricato il ${new Date().toLocaleDateString("it-IT")}.`;
  ws.getCell("A3").font = { size: 9, italic: true, color: { argb: "FF6E6E6E" } };
  const h = ws.getRow(5);
  h.values = ["Codice", "Serie", "Prezzo netto €", "A magazzino"];
  h.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3853" } }; });
  a.listino.forEach((r, i) => {
    const row = ws.addRow([r.codice, r.serie ?? "", r.prezzo, r.magazzino ? "Sì" : "No"]);
    row.getCell(3).numFmt = "#,##0.00";
    if (i % 2) row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F4" } }; });
  });
  ws.autoFilter = { from: "A5", to: `D${5 + a.listino.length}` };

  await registra("scarica_excel");
  const buf = await wb.xlsx.writeBuffer();
  const nome = `Listino_${a.brand}_${a.anno}_${area.cliente}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
