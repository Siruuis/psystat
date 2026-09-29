import type { Variable, Row, Selection } from "../types";

function cell(rows: Row[], variables: Variable[], r: number, c: number): string {
  if (c >= variables.length || r >= rows.length) return "";
  const v = rows[r][variables[c].name];
  return v == null ? "" : String(v);
}

export function selectionToTSV(variables: Variable[], rows: Row[], sel: Selection): string {
  const rMin = Math.min(sel.ar, sel.fr);
  const rMax = Math.max(sel.ar, sel.fr);
  const cMin = Math.min(sel.ac, sel.fc);
  const cMax = Math.max(sel.ac, sel.fc);
  const out: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    const line: string[] = [];
    for (let c = cMin; c <= cMax; c++) line.push(cell(rows, variables, r, c));
    out.push(line.join("\t"));
  }
  return out.join("\n");
}

export function writeClipboard(text: string) {
  if (window.psystat?.clipboardWrite) window.psystat.clipboardWrite(text);
  else navigator.clipboard?.writeText(text);
}
