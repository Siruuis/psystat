import { useState } from "react";
import { useStore } from "../state/store";
import { runTransform } from "../lib/engine";

export function SelectCasesDialog({ onClose }: { onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilter = useStore((s) => s.clearFilter);
  const setNotice = useStore((s) => s.setNotice);
  const filterExpr = useStore((s) => s.filterExpr);

  const [expr, setExpr] = useState(filterExpr ?? "");
  const [busy, setBusy] = useState(false);

  const insert = (t: string) => setExpr((e) => (e + " " + t).trim());

  const apply = async () => {
    if (!expr.trim()) return;
    setBusy(true);
    try {
      const res = await runTransform("compute", variables, rows, { expression: expr });
      if (res.error) setNotice(res.error);
      else if (res.values) {
        const mask = res.values.map((v) => v != null && Number(v) !== 0 && !isNaN(Number(v)));
        setFilter(expr, mask);
        const kept = mask.filter(Boolean).length;
        setNotice(`Filtre appliqué : ${kept} / ${rows.length} observations conservées.`);
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
        <h2>Sélectionner des observations</h2>
        <div className="dialog-body">
          <div className="field">
            <label>Condition (les observations vraies sont conservées)</label>
            <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="ex : age >= 18" />
          </div>
          <div className="field">
            <label>Variables</label>
            <div className="token-list">
              {variables.map((v) => (
                <button key={v.name} className="token" onClick={() => insert(v.name)}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Opérateurs</label>
            <div className="token-list">
              {[">", ">=", "<", "<=", "==", "!=", "&", "|", "(", ")"].map((o) => (
                <button key={o} className="token op" onClick={() => insert(o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">Combine les conditions avec & (et) et | (ou). Exemple : (age {">"} 18) & (score {"<"} 10)</p>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={() => { clearFilter(); setNotice("Filtre retiré."); onClose(); }}>
            Retirer le filtre
          </button>
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={busy || !expr.trim()} onClick={apply}>
            {busy ? "…" : "Appliquer"}
          </button>
        </div>
      </div>
    </div>
  );
}
