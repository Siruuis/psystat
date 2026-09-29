import { useState } from "react";
import { useStore } from "../state/store";
import { runTransform } from "../lib/engine";

export function RecodeDialog({ onClose }: { onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const addComputedColumn = useStore((s) => s.addComputedColumn);
  const setNotice = useStore((s) => s.setNotice);

  const [source, setSource] = useState(variables[0]?.name ?? "");
  const [target, setTarget] = useState("recode_var");
  const [rules, setRules] = useState<{ from: string; to: string }[]>([{ from: "", to: "" }]);
  const [busy, setBusy] = useState(false);

  const setRule = (i: number, key: "from" | "to", val: string) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const submit = async () => {
    if (!source || !target.trim()) return;
    setBusy(true);
    try {
      const clean = rules
        .filter((r) => r.from.trim() !== "")
        .map((r) => ({ from: r.from.trim(), to: isNaN(Number(r.to)) ? r.to : Number(r.to) }));
      const res = await runTransform("recode", variables, rows, { source, rules: clean, keep_else: true });
      if (res.error) setNotice(res.error);
      else if (res.values) {
        addComputedColumn(target.trim(), res.values);
        setNotice(`Variable « ${target.trim()} » recodée.`);
        onClose();
      }
    } catch (e) {
      setNotice(String(e));
    }
    setBusy(false);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Recoder en une variable différente</h2>
        <div className="dialog-body">
          <div className="field">
            <label>Variable source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {variables.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Nouvelle variable</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="field">
            <label>Règles (ancienne valeur → nouvelle valeur)</label>
            {rules.map((r, i) => (
              <div className="pair-row" key={i}>
                <input className="pair-value" value={r.from} onChange={(e) => setRule(i, "from", e.target.value)} />
                <span className="pair-arrow">→</span>
                <input className="pair-value" value={r.to} onChange={(e) => setRule(i, "to", e.target.value)} />
                <button className="link-btn" onClick={() => setRules((p) => p.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="ghost" onClick={() => setRules((p) => [...p, { from: "", to: "" }])}>
              + Ajouter une règle
            </button>
          </div>
          <p className="hint">Les valeurs non listées sont conservées telles quelles.</p>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={busy} onClick={submit}>
            {busy ? "Recodage…" : "Recoder"}
          </button>
        </div>
      </div>
    </div>
  );
}
