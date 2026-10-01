import { loadPyodide, version as pyodideVersion } from "pyodide";
import type { Variable, Row } from "../types";

const engineFiles = import.meta.glob("/engine/*.py", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const analysisFiles = import.meta.glob("/engine/analyses/*.py", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export type EngineState = { label: string; progress: number; done: boolean };

let pyodide: any = null;
let ready: Promise<void> | null = null;
let state: EngineState = { label: "", progress: 0, done: false };
const statusListeners = new Set<(s: EngineState) => void>();

let target = 0;
let trickle: ReturnType<typeof setInterval> | null = null;

function emit() {
  statusListeners.forEach((fn) => fn(state));
}

function startTrickle() {
  if (trickle) return;
  trickle = setInterval(() => {
    if (state.progress < target) {
      const next = Math.min(target, state.progress + Math.max(0.4, (target - state.progress) * 0.06));
      state = { ...state, progress: next };
      emit();
    }
  }, 120);
}

function stopTrickle() {
  if (trickle) {
    clearInterval(trickle);
    trickle = null;
  }
}

const LOADING_LABEL = "Chargement du moteur de calcul…";

function setPhase(to: number) {
  state = { label: LOADING_LABEL, progress: state.progress, done: false };
  target = to;
  emit();
  startTrickle();
}

function finishPhase() {
  stopTrickle();
  state = { label: "", progress: 100, done: true };
  emit();
}

export function onEngineStatus(fn: (s: EngineState) => void): () => void {
  statusListeners.add(fn);
  if (state.label || state.done) fn(state);
  return () => statusListeners.delete(fn);
}

export function getEngineState(): EngineState {
  return state;
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
    try {
      await load();
    } catch (e) {
      stopTrickle();
      throw e;
    }
  })();
  return ready;
}

async function load(): Promise<void> {
  {
    setPhase(15);
    pyodide = await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/` });
    setPhase(45);
    await pyodide.loadPackage(["numpy", "scipy", "pandas", "scikit-learn", "statsmodels", "matplotlib", "micropip"]);
    setPhase(95);
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
    setPhase(99);
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
    finishPhase();
  }
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
