export type Measure = "scale" | "nominal" | "ordinal";
export type VarType = "numeric" | "string";
export type Align = "left" | "center" | "right";
export type Role = "input" | "target" | "both" | "none";

export interface Variable {
  name: string;
  type: VarType;
  measure: Measure;
  label: string;
  labels: Record<string, string>;
  missing: (string | number)[];
  decimals: number;
  align: Align;
  columns: number;
  role: Role;
}

export type Row = Record<string, string | number | null>;

export interface Selection {
  ar: number;
  ac: number;
  fr: number;
  fc: number;
}

export interface ResultTable {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  footnotes?: string[];
}

export interface ResultImage {
  title: string;
  src: string;
}

export interface AnalysisResult {
  id: string;
  title: string;
  tables?: ResultTable[];
  images?: ResultImage[];
  apa?: string;
  error?: string;
  ranAt: string;
}
