import type { Variable, Row } from "../types";

const baseUrl = window.psystat?.engineUrl ?? "http://127.0.0.1:8000";

function buildMeta(variables: Variable[]) {
  const meta: Record<string, unknown> = {};
  for (const v of variables) {
    meta[v.name] = {
      name: v.name,
      type: v.type,
      measure: v.measure,
      label: v.label || null,
      labels: v.labels,
      missing: v.missing,
    };
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
  const payload = {
    analysis,
    dataset: {
      columns: variables.map((v) => v.name),
      rows,
      meta: buildMeta(variables),
    },
    params,
    split,
    weight,
  };
  const res = await fetch(`${baseUrl}/run`, {
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
  const payload = {
    transform,
    dataset: { columns: variables.map((v) => v.name), rows, meta: buildMeta(variables) },
    params,
  };
  const res = await fetch(`${baseUrl}/transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Moteur : ${res.status}`);
  return res.json();
}

export async function engineHealth() {
  try {
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
