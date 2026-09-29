import { useState } from "react";
import { useStore } from "../state/store";

export type TransformMode = "rank" | "autorecode" | "count";

const TITLES: Record<TransformMode, string> = {
  rank: "Rang des observations",
  autorecode: "Recodage automatique",
  count: "Compter les occurrences",
};

export function TransformDialog({ mode, onClose }: { mode: TransformMode; onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const rankColumn = useStore((s) => s.rankColumn);
  const autoRecode = useStore((s) => s.autoRecode);
  const countOccurrences = useStore((s) => s.countOccurrences);
  const setNotice = useStore((s) => s.setNotice);

  const [source, setSource] = useState(variables[0]?.name ?? "");
  const [sources, setSources] = useState<string[]>([]);
  const [values, setValues] = useState("");
  const [target, setTarget] = useState(mode === "rank" ? "rang" : mode === "autorecode" ? "recode" : "compte");

  const toggle = (name: string) =>
    setSources((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const submit = () => {
    if (!target.trim()) return;
    if (mode === "rank") rankColumn(source, target.trim());
    else if (mode === "autorecode") autoRecode(source, target.trim());
    else countOccurrences(sources, values.split(",").map((v) => v.trim()).filter(Boolean), target.trim());
    setNotice(`Variable « ${target.trim()} » créée.`);
    onClose();
  };

  const valid = mode === "count" ? sources.length > 0 && values.trim() !== "" : !!source;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{TITLES[mode]}</h2>
        <div className="dialog-body">
          {mode === "count" ? (
            <>
              <div className="field">
                <label>Variables à examiner</label>
                <div className="checklist">
                  {variables.map((v) => (
                    <label key={v.name} className="check">
                      <input type="checkbox" checked={sources.includes(v.name)} onChange={() => toggle(v.name)} />
                      {v.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Valeurs à compter (séparées par des virgules)</label>
                <input value={values} onChange={(e) => setValues(e.target.value)} placeholder="ex : 1, 2" />
              </div>
            </>
          ) : (
            <div className="field">
              <label>Variable source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                {variables.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.label || v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Nouvelle variable</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={!valid} onClick={submit}>
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
