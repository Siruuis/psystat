import type { Variable, Row } from "../types";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveProject(fileName: string, variables: Variable[], rows: Row[]) {
  const payload = JSON.stringify({ version: 1, variables, rows }, null, 2);
  download(`${fileName || "projet"}.psystat`, payload, "application/json");
}

export async function openProject(file: File): Promise<{ variables: Variable[]; rows: Row[] }> {
  const text = await file.text();
  const data = JSON.parse(text);
  return { variables: data.variables ?? [], rows: data.rows ?? [] };
}

function escapeCsv(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(fileName: string, variables: Variable[], rows: Row[]) {
  const header = variables.map((v) => escapeCsv(v.name)).join(",");
  const lines = rows.map((row) => variables.map((v) => escapeCsv(row[v.name])).join(","));
  download(`${fileName || "donnees"}.csv`, [header, ...lines].join("\n"), "text/csv;charset=utf-8");
}
