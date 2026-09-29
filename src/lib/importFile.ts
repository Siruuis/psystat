import * as XLSX from "xlsx";
import type { Variable, Row, Measure } from "../types";

function inferColumn(name: string, values: (string | number | null)[]): Variable {
  let numeric = 0;
  let nonEmpty = 0;
  const distinct = new Set<string>();
  for (const v of values) {
    if (v === null || v === "" || v === undefined) continue;
    nonEmpty += 1;
    if (typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")) numeric += 1;
    distinct.add(String(v));
  }
  const isNumeric = nonEmpty > 0 && numeric / nonEmpty >= 0.95;
  let measure: Measure = "scale";
  if (!isNumeric) measure = "nominal";
  else if (distinct.size <= 5) measure = "ordinal";
  return {
    name,
    type: isNumeric ? "numeric" : "string",
    measure,
    label: "",
    labels: {},
    missing: [],
    decimals: 2,
    align: isNumeric ? "right" : "left",
    columns: 8,
    role: "input",
  };
}

export async function importFile(file: File): Promise<{ variables: Variable[]; rows: Row[] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });
  if (matrix.length === 0) return { variables: [], rows: [] };

  const header = matrix[0].map((h, i) => (h == null || h === "" ? `VAR${i + 1}` : String(h).trim()));
  const dataRows = matrix.slice(1);

  const columns: (string | number | null)[][] = header.map(() => []);
  for (const r of dataRows) {
    header.forEach((_, i) => columns[i].push(r[i] ?? null));
  }

  const variables = header.map((name, i) => inferColumn(name, columns[i]));
  const rows: Row[] = dataRows.map((r) => {
    const obj: Row = {};
    header.forEach((name, i) => {
      const raw = r[i] ?? null;
      const v = variables[i];
      obj[name] = v.type === "numeric" && raw !== null && raw !== "" ? Number(raw) : raw;
    });
    return obj;
  });

  return { variables, rows };
}
