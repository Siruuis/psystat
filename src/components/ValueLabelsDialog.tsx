import { useState } from "react";
import { useStore } from "../state/store";
import type { Variable } from "../types";

export function ValueLabelsDialog({ index, onClose }: { index: number; onClose: () => void }) {
  const variable = useStore((s) => s.variables[index]) as Variable;
  const updateVariable = useStore((s) => s.updateVariable);

  const [pairs, setPairs] = useState<{ value: string; label: string }[]>(
    Object.entries(variable.labels).map(([value, label]) => ({ value, label }))
  );
  const [missing, setMissing] = useState(variable.missing.join(", "));

  const setPair = (i: number, key: "value" | "label", val: string) =>
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));

  const addPair = () => setPairs((prev) => [...prev, { value: "", label: "" }]);
  const removePair = (i: number) => setPairs((prev) => prev.filter((_, idx) => idx !== i));

  const save = () => {
    const labels: Record<string, string> = {};
    for (const p of pairs) if (p.value.trim() !== "") labels[p.value.trim()] = p.label;
    const missingValues = missing
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => (isNaN(Number(s)) ? s : Number(s)));
    updateVariable(index, { labels, missing: missingValues });
    onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Étiquettes de valeurs — {variable.name}</h2>
        <div className="dialog-body">
          <div className="field">
            <label>Correspondances (valeur → étiquette)</label>
            {pairs.map((p, i) => (
              <div className="pair-row" key={i}>
                <input
                  className="pair-value"
                  placeholder="1"
                  value={p.value}
                  onChange={(e) => setPair(i, "value", e.target.value)}
                />
                <span className="pair-arrow">→</span>
                <input
                  className="pair-label"
                  placeholder="Homme"
                  value={p.label}
                  onChange={(e) => setPair(i, "label", e.target.value)}
                />
                <button className="link-btn" onClick={() => removePair(i)}>
                  ✕
                </button>
              </div>
            ))}
            <button className="ghost" onClick={addPair}>
              + Ajouter une correspondance
            </button>
          </div>
          <div className="field">
            <label>Valeurs manquantes (séparées par des virgules)</label>
            <input value={missing} onChange={(e) => setMissing(e.target.value)} placeholder="ex : 99, -1" />
          </div>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
