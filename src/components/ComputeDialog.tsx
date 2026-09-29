import { useState } from "react";
import { useStore } from "../state/store";
import { runTransform } from "../lib/engine";

export function ComputeDialog({ onClose }: { onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const addComputedColumn = useStore((s) => s.addComputedColumn);
  const setNotice = useStore((s) => s.setNotice);

  const [name, setName] = useState("nouvelle_var");
  const [expr, setExpr] = useState("");
  const [busy, setBusy] = useState(false);

  const insert = (token: string) => setExpr((e) => (e + " " + token).trim());

  const submit = async () => {
    if (!name.trim() || !expr.trim()) return;
    setBusy(true);
    try {
      const res = await runTransform("compute", variables, rows, { expression: expr });
      if (res.error) setNotice(res.error);
      else if (res.values) {
        addComputedColumn(name.trim(), res.values);
        setNotice(`Variable « ${name.trim()} » calculée.`);
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
        <h2>Calculer une variable</h2>
        <div className="dialog-body">
          <div className="field">
            <label>Nom de la variable cible</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Expression numérique</label>
            <input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="ex : (pre + post) / 2"
            />
          </div>
          <div className="field">
            <label>Variables (cliquer pour insérer)</label>
            <div className="checklist token-list">
              {variables.map((v) => (
                <button key={v.name} className="token" onClick={() => insert(v.name)}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Fonctions</label>
            <div className="token-list">
              {["+", "-", "*", "/", "(", ")", "sqrt(", "log(", "abs(", "mean(", "sum("].map((f) => (
                <button key={f} className="token op" onClick={() => insert(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={busy || !name.trim() || !expr.trim()} onClick={submit}>
            {busy ? "Calcul…" : "Calculer"}
          </button>
        </div>
      </div>
    </div>
  );
}
