import { useStore } from "../state/store";
import type { Variable, Row } from "../types";

const KEY = "psystat-autosave";

interface Snapshot {
  variables: Variable[];
  rows: Row[];
  fileName: string;
  savedAt: number;
}

export function loadAutosave(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Snapshot;
    if (!data.variables || data.variables.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function initAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((state) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        if (state.variables.length === 0 && state.rows.length === 0) {
          localStorage.removeItem(KEY);
          return;
        }
        const snap: Snapshot = {
          variables: state.variables,
          rows: state.rows,
          fileName: state.fileName,
          savedAt: Date.now(),
        };
        localStorage.setItem(KEY, JSON.stringify(snap));
      } catch {
        /* quota exceeded — ignore silently */
      }
    }, 700);
  });
}
