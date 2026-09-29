import type { Variable, Row } from "../types";
import { pyRunAnalysis, pyRunTransform, isPyodideReady } from "./pyodideEngine";

const electronUrl = window.psystat?.engineUrl;
const isElectron = !!electronUrl;

function buildMeta(variables: Variable[]) {
  const meta: Record<string, unknown> = {};
  for (const v of variables) {
    meta[v.name] = { name: v.name, type: v.type, measure: v.measure, label: v.label || null, labels: v.labels, missing: v.missing };
  }
  return meta;
}

export async function runAnalysis(
  analysis: string,
  variables: Variable[],
  rows: Row[],
  params: Record<string, unknown>,
  split: string[] = [],
  weight: string | null = null
) {
  if (!isElectron) {
    return pyRunAnalysis(analysis, variables, rows, params, split, weight);
  }
  const payload = {
    analysis,
    dataset: { columns: variables.map((v) => v.name), rows, meta: buildMeta(variables) },
    params,
    split,
    weight,
  };
  const res = await fetch(`${electronUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Moteur : ${res.status}`);
  return res.json();
}

export async function runTransform(
  transform: string,
  variables: Variable[],
  rows: Row[],
  params: Record<string, unknown>
): Promise<{ values?: (string | number | null)[]; error?: string }> {
  if (!isElectron) {
    return pyRunTransform(transform, variables, rows, params);
  }
  const payload = {
    transform,
    dataset: { columns: variables.map((v) => v.name), rows, meta: buildMeta(variables) },
    params,
  };
  const res = await fetch(`${electronUrl}/transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Moteur : ${res.status}`);
  return res.json();
}

export async function engineHealth(): Promise<boolean> {
  if (!isElectron) return isPyodideReady();
  try {
    const res = await fetch(`${electronUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
