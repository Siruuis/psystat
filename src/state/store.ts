import { create } from "zustand";
import type { Variable, Row, AnalysisResult, VarType, Selection } from "../types";
import { runAnalysis } from "../lib/engine";

function genName(existing: string[]): string {
  const set = new Set(existing);
  let i = existing.length + 1;
  let name = `VAR${String(i).padStart(5, "0")}`;
  while (set.has(name)) {
    i += 1;
    name = `VAR${String(i).padStart(5, "0")}`;
  }
  return name;
}

function makeVariable(name: string, type: VarType = "numeric"): Variable {
  return {
    name,
    type,
    measure: type === "numeric" ? "scale" : "nominal",
    label: "",
    labels: {},
    missing: [],
    decimals: 2,
    align: type === "numeric" ? "right" : "left",
    columns: 8,
    role: "input",
  };
}

function emptyRow(variables: Variable[]): Row {
  const r: Row = {};
  variables.forEach((v) => (r[v.name] = null));
  return r;
}

function withAllKeys(rows: Row[], variables: Variable[]): Row[] {
  return rows.map((row) => {
    const nr = { ...row };
    variables.forEach((v) => {
      if (!(v.name in nr)) nr[v.name] = null;
    });
    return nr;
  });
}

interface Snapshot {
  variables: Variable[];
  rows: Row[];
}

interface AppState {
  variables: Variable[];
  rows: Row[];
  results: AnalysisResult[];
  running: boolean;
  past: Snapshot[];
  future: Snapshot[];
  fileName: string;
  selection: Selection;
  setSelection: (sel: Selection) => void;
  showValueLabels: boolean;
  toggleValueLabels: () => void;
  notice: string | null;
  setNotice: (msg: string | null) => void;
  filterExpr: string | null;
  filterMask: boolean[] | null;
  setFilter: (expr: string, mask: boolean[]) => void;
  clearFilter: () => void;
  splitVar: string | null;
  weightVar: string | null;
  setSplit: (name: string | null) => void;
  setWeight: (name: string | null) => void;
  activeRows: () => Row[];
  transpose: () => void;
  rankColumn: (source: string, target: string) => void;
  countOccurrences: (sources: string[], values: string[], target: string) => void;
  autoRecode: (source: string, target: string) => void;
  loadData: (variables: Variable[], rows: Row[], fileName?: string) => void;
  newDataset: () => void;
  updateVariable: (index: number, patch: Partial<Variable>) => void;
  renameVariable: (index: number, newName: string) => void;
  addVariable: () => void;
  insertVariable: (index: number) => void;
  removeVariable: (index: number) => void;
  moveVariable: (from: number, to: number) => void;
  insertRow: (index: number) => void;
  removeRow: (index: number) => void;
  removeRows: (indexes: number[]) => void;
  addRow: () => void;
  setCellAuto: (rowIndex: number, colIndex: number, value: string) => void;
  deleteRange: (r1: number, c1: number, r2: number, c2: number) => void;
  pasteMatrix: (startRow: number, startCol: number, matrix: string[][]) => void;
  sortByColumn: (colIndex: number, ascending: boolean) => void;
  addComputedColumn: (name: string, values: (string | number | null)[]) => void;
  undo: () => void;
  redo: () => void;
  clearResults: () => void;
  addResult: (result: Omit<AnalysisResult, "id" | "ranAt">) => void;
  execute: (analysis: string, title: string, params: Record<string, unknown>) => Promise<void>;
  project: () => Snapshot;
}

function pushHistory(state: AppState) {
  return {
    past: [...state.past, { variables: state.variables, rows: state.rows }].slice(-100),
    future: [] as Snapshot[],
  };
}

export const useStore = create<AppState>((set, get) => ({
  variables: [],
  rows: [],
  results: [],
  running: false,
  past: [],
  future: [],
  fileName: "Sans titre",
  selection: { ar: 0, ac: 0, fr: 0, fc: 0 },
  showValueLabels: false,
  notice: null,
  filterExpr: null,
  filterMask: null,
  splitVar: null,
  weightVar: null,

  setSplit: (name) => set({ splitVar: name }),
  setWeight: (name) => set({ weightVar: name }),

  setSelection: (selection) => set({ selection }),
  toggleValueLabels: () => set((state) => ({ showValueLabels: !state.showValueLabels })),
  setNotice: (notice) => set({ notice }),

  setFilter: (expr, mask) => set({ filterExpr: expr, filterMask: mask }),
  clearFilter: () => set({ filterExpr: null, filterMask: null }),
  activeRows: () => {
    const { rows, filterMask } = get();
    return filterMask && filterMask.length === rows.length ? rows.filter((_, i) => filterMask[i]) : rows;
  },

  transpose: () =>
    set((state) => {
      const { variables, rows } = state;
      if (!variables.length) return {};
      const newVars: Variable[] = [makeVariable("variable", "string")];
      rows.forEach((_, i) => newVars.push(makeVariable(`obs${i + 1}`)));
      const newRows: Row[] = variables.map((v) => {
        const row: Row = { variable: v.name };
        rows.forEach((r, i) => (row[`obs${i + 1}`] = r[v.name]));
        return row;
      });
      return { ...pushHistory(state), variables: newVars, rows: newRows, filterMask: null, filterExpr: null };
    }),

  rankColumn: (source, target) =>
    set((state) => {
      const vals = state.rows.map((r, i) => ({ i, v: r[source] == null ? null : Number(r[source]) }));
      const present = vals.filter((x) => x.v != null && !isNaN(x.v as number)) as { i: number; v: number }[];
      present.sort((a, b) => a.v - b.v);
      const ranks = new Array(state.rows.length).fill(null) as (number | null)[];
      let k = 0;
      while (k < present.length) {
        let j = k;
        while (j + 1 < present.length && present[j + 1].v === present[k].v) j++;
        const avg = (k + j) / 2 + 1;
        for (let m = k; m <= j; m++) ranks[present[m].i] = avg;
        k = j + 1;
      }
      const variables = state.variables.slice();
      variables.push(makeVariable(target));
      const rows = state.rows.map((r, i) => ({ ...r, [target]: ranks[i] }));
      return { ...pushHistory(state), variables, rows };
    }),

  countOccurrences: (sources, values, target) =>
    set((state) => {
      const set2 = new Set(values.map((v) => v.trim()));
      const variables = state.variables.slice();
      variables.push(makeVariable(target));
      const rows = state.rows.map((r) => {
        let count = 0;
        for (const s of sources) {
          const val = r[s];
          if (val != null && set2.has(String(val))) count++;
        }
        return { ...r, [target]: count };
      });
      return { ...pushHistory(state), variables, rows };
    }),

  autoRecode: (source, target) =>
    set((state) => {
      const distinct = Array.from(
        new Set(state.rows.map((r) => r[source]).filter((v) => v != null).map((v) => String(v)))
      ).sort((a, b) => (isNaN(Number(a)) || isNaN(Number(b)) ? a.localeCompare(b) : Number(a) - Number(b)));
      const mapping = new Map(distinct.map((v, i) => [v, i + 1]));
      const labels: Record<string, string> = {};
      distinct.forEach((v, i) => (labels[String(i + 1)] = v));
      const variables = state.variables.slice();
      const variable = makeVariable(target);
      variable.labels = labels;
      variable.measure = "nominal";
      variables.push(variable);
      const rows = state.rows.map((r) => {
        const val = r[source];
        return { ...r, [target]: val == null ? null : mapping.get(String(val)) ?? null };
      });
      return { ...pushHistory(state), variables, rows };
    }),

  loadData: (variables, rows, fileName) =>
    set((state) => ({ ...pushHistory(state), variables, rows, fileName: fileName ?? state.fileName, filterMask: null, filterExpr: null })),

  newDataset: () =>
    set((state) => ({ ...pushHistory(state), variables: [], rows: [], fileName: "Sans titre", filterMask: null, filterExpr: null })),

  updateVariable: (index, patch) =>
    set((state) => {
      const variables = state.variables.slice();
      variables[index] = { ...variables[index], ...patch };
      return { ...pushHistory(state), variables };
    }),

  renameVariable: (index, newName) =>
    set((state) => {
      const target = newName.trim();
      if (!target) return {};
      const variables = state.variables.slice();
      const old = variables[index].name;
      if (old === target) return {};
      const others = new Set(variables.filter((_, i) => i !== index).map((v) => v.name));
      let unique = target;
      let k = 1;
      while (others.has(unique)) unique = `${target}_${k++}`;
      variables[index] = { ...variables[index], name: unique };
      const rows = state.rows.map((row) => {
        const nr = { ...row };
        nr[unique] = nr[old] ?? null;
        if (old !== unique) delete nr[old];
        return nr;
      });
      return { ...pushHistory(state), variables, rows };
    }),

  insertVariable: (index) =>
    set((state) => {
      const variables = state.variables.slice();
      const name = genName(variables.map((v) => v.name));
      variables.splice(index, 0, makeVariable(name));
      return { ...pushHistory(state), variables, rows: withAllKeys(state.rows, variables) };
    }),

  addVariable: () => get().insertVariable(get().variables.length),

  removeVariable: (index) =>
    set((state) => {
      if (index < 0 || index >= state.variables.length) return {};
      const variables = state.variables.slice();
      const [removed] = variables.splice(index, 1);
      const rows = state.rows.map((row) => {
        const nr = { ...row };
        delete nr[removed.name];
        return nr;
      });
      return { ...pushHistory(state), variables, rows };
    }),

  moveVariable: (from, to) =>
    set((state) => {
      if (from === to || from < 0 || to < 0 || from >= state.variables.length || to >= state.variables.length)
        return {};
      const variables = state.variables.slice();
      const [moved] = variables.splice(from, 1);
      variables.splice(to, 0, moved);
      return { ...pushHistory(state), variables };
    }),

  insertRow: (index) =>
    set((state) => {
      const rows = state.rows.slice();
      rows.splice(Math.min(index, rows.length), 0, emptyRow(state.variables));
      return { ...pushHistory(state), rows };
    }),

  removeRow: (index) =>
    set((state) => {
      if (index < 0 || index >= state.rows.length) return {};
      const rows = state.rows.slice();
      rows.splice(index, 1);
      return { ...pushHistory(state), rows };
    }),

  removeRows: (indexes) =>
    set((state) => {
      const drop = new Set(indexes);
      const rows = state.rows.filter((_, i) => !drop.has(i));
      return { ...pushHistory(state), rows };
    }),

  addRow: () => set((state) => ({ ...pushHistory(state), rows: [...state.rows, emptyRow(state.variables)] })),

  setCellAuto: (rowIndex, colIndex, value) =>
    set((state) => {
      const variables = state.variables.slice();
      while (variables.length <= colIndex) {
        const isTarget = variables.length === colIndex;
        const looksText = value !== "" && isNaN(Number(value));
        variables.push(makeVariable(genName(variables.map((v) => v.name)), isTarget && looksText ? "string" : "numeric"));
      }
      const rows = withAllKeys(state.rows, variables);
      while (rows.length <= rowIndex) rows.push(emptyRow(variables));
      const target = variables[colIndex];
      rows[rowIndex] = { ...rows[rowIndex], [target.name]: value === "" ? null : value };
      return { ...pushHistory(state), variables, rows };
    }),

  deleteRange: (r1, c1, r2, c2) =>
    set((state) => {
      const rows = state.rows.slice();
      for (let r = r1; r <= r2 && r < rows.length; r++) {
        const nr = { ...rows[r] };
        for (let c = c1; c <= c2 && c < state.variables.length; c++) nr[state.variables[c].name] = null;
        rows[r] = nr;
      }
      return { ...pushHistory(state), rows };
    }),

  pasteMatrix: (startRow, startCol, matrix) =>
    set((state) => {
      if (matrix.length === 0) return {};
      const width = Math.max(...matrix.map((r) => r.length));
      const variables = state.variables.slice();
      while (variables.length < startCol + width) {
        const col = variables.length - startCol;
        const vals = matrix.map((r) => r[col] ?? "").filter((x) => x !== "");
        const numeric = vals.length > 0 && vals.every((x) => !isNaN(Number(x)));
        variables.push(makeVariable(genName(variables.map((v) => v.name)), numeric ? "numeric" : "string"));
      }
      const rows = withAllKeys(state.rows, variables);
      while (rows.length < startRow + matrix.length) rows.push(emptyRow(variables));
      matrix.forEach((rowVals, ri) => {
        rowVals.forEach((val, ci) => {
          const v = variables[startCol + ci];
          const s = String(val);
          rows[startRow + ri] = { ...rows[startRow + ri], [v.name]: s === "" ? null : s };
        });
      });
      return { ...pushHistory(state), variables, rows };
    }),

  sortByColumn: (colIndex, ascending) =>
    set((state) => {
      const v = state.variables[colIndex];
      if (!v) return {};
      const numeric = v.type === "numeric";
      const rows = state.rows.slice().sort((a, b) => {
        const av = a[v.name];
        const bv = b[v.name];
        if (av == null) return 1;
        if (bv == null) return -1;
        let cmp: number;
        if (numeric) cmp = Number(av) - Number(bv);
        else cmp = String(av).localeCompare(String(bv));
        return ascending ? cmp : -cmp;
      });
      return { ...pushHistory(state), rows, filterMask: null, filterExpr: null };
    }),

  addComputedColumn: (name, values) =>
    set((state) => {
      const variables = state.variables.slice();
      const existing = variables.findIndex((v) => v.name === name);
      const numeric = values.every((x) => x == null || !isNaN(Number(x)));
      const variable = makeVariable(name, numeric ? "numeric" : "string");
      let rows = state.rows.slice();
      while (rows.length < values.length) rows.push(emptyRow(variables));
      if (existing >= 0) {
        variables[existing] = { ...variables[existing], type: variable.type };
        rows = rows.map((row, i) => ({ ...row, [name]: values[i] ?? null }));
      } else {
        variables.push(variable);
        rows = rows.map((row, i) => ({ ...row, [name]: values[i] ?? null }));
      }
      return { ...pushHistory(state), variables, rows };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const prev = state.past[state.past.length - 1];
      return {
        variables: prev.variables,
        rows: prev.rows,
        past: state.past.slice(0, -1),
        future: [...state.future, { variables: state.variables, rows: state.rows }].slice(-100),
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[state.future.length - 1];
      return {
        variables: next.variables,
        rows: next.rows,
        future: state.future.slice(0, -1),
        past: [...state.past, { variables: state.variables, rows: state.rows }].slice(-100),
      };
    }),

  clearResults: () => set({ results: [] }),

  addResult: (result) =>
    set((state) => ({
      results: [
        ...state.results,
        { ...result, id: crypto.randomUUID(), ranAt: new Date().toLocaleTimeString("fr-FR") },
      ],
    })),

  execute: async (analysis, title, params) => {
    set({ running: true });
    const variables = get().variables;
    const rows = get().activeRows();
    const split = get().splitVar ? [get().splitVar as string] : [];
    const weight = get().weightVar;
    try {
      const data = await runAnalysis(analysis, variables, rows, params, split, weight);
      get().addResult({ title: data.title ?? title, tables: data.tables, images: data.images, error: data.error });
      set({ running: false });
    } catch (err) {
      get().addResult({ title, error: String(err) });
      set({ running: false });
    }
  },

  project: () => ({ variables: get().variables, rows: get().rows }),
}));
