import { useState } from "react";
import { useStore } from "../state/store";

export function FindDialog({ onClose }: { onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const setNotice = useStore((s) => s.setNotice);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("__all__");

  const findNext = () => {
    if (!query.trim()) return;
    const cols = scope === "__all__" ? variables.map((_, i) => i) : [variables.findIndex((v) => v.name === scope)];
    const start = selection.fr * variables.length + selection.fc + 1;
    const total = rows.length * variables.length;
    for (let step = 0; step < total; step++) {
      const idx = (start + step) % total;
      const r = Math.floor(idx / variables.length);
      const c = idx % variables.length;
      if (!cols.includes(c)) continue;
      const val = rows[r][variables[c].name];
      if (val != null && String(val).toLowerCase().includes(query.toLowerCase())) {
        setSelection({ ar: r, ac: c, fr: r, fc: c });
        document.getElementById(`c-${r}-${c}`)?.scrollIntoView({ block: "center" });
        return;
      }
    }
    setNotice("Aucune occurrence trouvée.");
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h2>Rechercher</h2>
        <div className="dialog-body">
          <div className="field">
            <label>Valeur à rechercher</label>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findNext()} />
          </div>
          <div className="field">
            <label>Dans</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="__all__">Toutes les variables</option>
              {variables.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>
            Fermer
          </button>
          <button className="primary" onClick={findNext}>
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
