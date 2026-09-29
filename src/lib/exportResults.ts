import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  AlignmentType,
} from "docx";
import type { AnalysisResult, ResultTable } from "../types";

function decodeBase64(dataUri: string): Uint8Array {
  const b64 = dataUri.split(",")[1] ?? dataUri;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function pngSize(bytes: Uint8Array): { w: number; h: number } {
  const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { w: w || 640, h: h || 400 };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function docTable(table: ResultTable): Table {
  const header = new TableRow({
    tableHeader: true,
    children: table.columns.map(
      (c) =>
        new TableCell({
          shading: { fill: "EEF1F5" },
          children: [new Paragraph({ children: [new TextRun({ text: String(c), bold: true, size: 20 })] })],
        })
    ),
  });
  const body = table.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell == null ? "" : String(cell), size: 20 })] })],
            })
        ),
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

export async function exportWord(fileName: string, results: AnalysisResult[]) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "Résultats statistiques", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `PsyStat — ${new Date().toLocaleDateString("fr-FR")}`, italics: true })] }),
  ];

  let tableNo = 1;
  let figNo = 1;
  for (const res of results) {
    children.push(new Paragraph({ text: res.title, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));
    if (res.error) {
      children.push(new Paragraph({ children: [new TextRun({ text: res.error, color: "C0392B" })] }));
      continue;
    }
    for (const t of res.tables ?? []) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Tableau ${tableNo}`, bold: true })], spacing: { before: 200 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: t.title, italics: true })] }));
      children.push(docTable(t));
      for (const f of t.footnotes ?? []) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Note. ${f}`, italics: true, size: 18 })] }));
      }
      tableNo++;
    }
    for (const img of res.images ?? []) {
      const data = decodeBase64(img.src);
      const { w, h } = pngSize(data);
      const width = Math.min(520, w);
      const height = Math.round((h / w) * width);
      children.push(new Paragraph({ children: [new TextRun({ text: `Figure ${figNo}`, bold: true })], spacing: { before: 200 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: img.title, italics: true })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data, transformation: { width, height } })] }));
      figNo++;
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${fileName || "resultats"}.docx`);
}

function tableHtml(table: ResultTable, tableNo: number): string {
  const head = table.columns.map((c) => `<th>${escapeHtml(String(c))}</th>`).join("");
  const body = table.rows
    .map((r) => `<tr>${r.map((c) => `<td>${c == null ? "" : escapeHtml(String(c))}</td>`).join("")}</tr>`)
    .join("");
  const notes = (table.footnotes ?? []).map((f) => `<p class="note">Note. ${escapeHtml(f)}</p>`).join("");
  return `<p class="tnum">Tableau ${tableNo}</p><p class="ttitle">${escapeHtml(table.title)}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${notes}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exportPdf(fileName: string, results: AnalysisResult[]) {
  let tableNo = 1;
  let figNo = 1;
  const blocks: string[] = [];
  for (const res of results) {
    blocks.push(`<h2>${escapeHtml(res.title)}</h2>`);
    if (res.error) {
      blocks.push(`<p class="err">${escapeHtml(res.error)}</p>`);
      continue;
    }
    for (const t of res.tables ?? []) blocks.push(tableHtml(t, tableNo++));
    for (const img of res.images ?? []) {
      blocks.push(`<p class="tnum">Figure ${figNo++}</p><p class="ttitle">${escapeHtml(img.title)}</p><img src="${img.src}" />`);
    }
  }
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title>
    <style>
      body { font-family: "Times New Roman", serif; font-size: 12pt; color: #000; margin: 2.5cm; }
      h1 { font-size: 15pt; }
      h2 { font-size: 13pt; margin-top: 22px; }
      .tnum { font-weight: bold; margin: 16px 0 0; }
      .ttitle { font-style: italic; margin: 0 0 6px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 6px; page-break-inside: avoid; }
      th, td { padding: 4px 8px; text-align: left; font-size: 10.5pt; }
      thead th { border-top: 1.5px solid #000; border-bottom: 1px solid #000; }
      tbody tr:last-child td { border-bottom: 1.5px solid #000; }
      .note { font-style: italic; font-size: 9.5pt; margin: 2px 0 0; }
      .err { color: #c0392b; }
      img { max-width: 100%; page-break-inside: avoid; }
    </style></head>
    <body><h1>Résultats statistiques</h1><p><i>PsyStat — ${new Date().toLocaleDateString("fr-FR")}</i></p>${blocks.join("")}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, 400);
}
