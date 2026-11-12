import { useStore } from "../state/store";
import type { Variable, Row } from "../types";

const LEGACY_KEY = "psystat-autosave";
const PREFIX = "psystat-autosave:";

let owner = "local";
let stopped = false;

interface Snapshot {
  variables: Variable[];
  rows: Row[];
  fileName: string;
  savedAt: number;
}

const key = () => PREFIX + owner;

export function setAutosaveOwner(id: string) {
  owner = id.toLowerCase();
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      if (owner === "local" && localStorage.getItem(key()) === null) localStorage.setItem(key(), legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {}
}

export function loadAutosave(): Snapshot | null {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return null;
    const data = JSON.parse(raw) as Snapshot;
    if (!data.variables || data.variables.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearAutosave() {
  stopped = true;
  try {
    localStorage.removeItem(key());
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export function initAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((state) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopped) return;
      try {
        if (state.variables.length === 0 && state.rows.length === 0) {
          localStorage.removeItem(key());
          return;
        }
        const snap: Snapshot = {
          variables: state.variables,
          rows: state.rows,
          fileName: state.fileName,
          savedAt: Date.now(),
        };
        localStorage.setItem(key(), JSON.stringify(snap));
      } catch {
        /* quota exceeded — ignore silently */
      }
    }, 700);
  });
}
