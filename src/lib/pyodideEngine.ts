import { loadPyodide, version as pyodideVersion } from "pyodide";
import type { Variable, Row } from "../types";

const engineFiles = import.meta.glob("/engine/*.py", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const analysisFiles = import.meta.glob("/engine/analyses/*.py", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

let pyodide: any = null;
let ready: Promise<void> | null = null;
let currentStatus = "";
const statusListeners = new Set<(s: string) => void>();

function setStatus(s: string) {
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

export function onEngineStatus(fn: (s: string) => void): () => void {
  statusListeners.add(fn);
  if (currentStatus) fn(currentStatus);
  return () => statusListeners.delete(fn);
}

export function getEngineStatus(): string {
  return currentStatus;
}

function buildMeta(variables: Variable[]) {
  const meta: Record<string, unknown> = {};
  for (const v of variables) {
    meta[v.name] = { name: v.name, type: v.type, measure: v.measure, label: v.label || null, labels: v.labels, missing: v.missing };
  }
  return meta;
}

export function isPyodideReady(): boolean {
  return pyodide != null;
}

export function initPyodide(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    setStatus("Démarrage de Python…");
    pyodide = await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/` });
    setStatus("Chargement des bibliothèques scientifiques…");
    await pyodide.loadPackage(["numpy", "scipy", "pandas", "scikit-learn", "statsmodels", "matplotlib", "micropip"]);
    setStatus("Installation de pingouin…");
    const micropip = pyodide.pyimport("micropip");
    try {
      await micropip.install("pingouin==0.5.4");
    } catch {
      try {
        await micropip.install(["pandas_flavor", "tabulate", "outdated"]);
        await micropip.install("pingouin==0.5.4", { deps: false });
      } catch (e) {
        console.error("pingouin install failed", e);
      }
    }
    onStatus?.("Chargement du moteur PsyStat…");
    for (const dir of ["/pyengine", "/pyengine/analyses"]) {
      try {
        pyodide.FS.mkdir(dir);
      } catch {
        /* exists */
      }
    }
    for (const [path, src] of Object.entries(engineFiles)) {
      const name = path.split("/").pop()!;
      if (name === "main.py") continue;
      pyodide.FS.writeFile(`/pyengine/${name}`, src);
    }
    for (const [path, src] of Object.entries(analysisFiles)) {
      const name = path.split("/").pop()!;
      pyodide.FS.writeFile(`/pyengine/analyses/${name}`, src);
    }
    pyodide.runPython("import sys, warnings; warnings.filterwarnings('ignore'); sys.path.insert(0, '/pyengine'); import webengine");
    setStatus("");
  })();
  return ready;
}

async function callJson(fn: "run_json" | "transform_json", payload: unknown): Promise<any> {
  await initPyodide();
  const webengine = pyodide.pyimport("webengine");
  const out = webengine[fn](JSON.stringify(payload)) as string;
  return JSON.parse(out);
}

export function pyRunAnalysis(
  analysis: string,
  variables: Variable[],
  rows: Row[],
  params: Record<string, unknown>,
  split: string[] = [],
  weight: string | null = null
) {
  return callJson("run_json", {
    analysis,
    dataset: { columns: variables.map((v) => v.name), rows, meta: buildMeta(variables) },
    params,
    split,
    weight,
  });
}

export function pyRunTransform(transform: string, variables: Variable[], rows: Row[], params: Record<string, unknown>) {
  return callJson("transform_json", {
    transform,
    dataset: { columns: variables.map((v) => v.name), rows, meta: buildMeta(variables) },
    params,
  });
}
