import { useState } from "react";
import { useStore } from "../state/store";
import type { Measure, VarType, Align, Role } from "../types";
import { ValueLabelsDialog } from "./ValueLabelsDialog";

const MEASURES: Measure[] = ["scale", "nominal", "ordinal"];
const TYPES: VarType[] = ["numeric", "string"];
const ALIGNS: Align[] = ["left", "center", "right"];
const ROLES: Role[] = ["input", "target", "both", "none"];
const MEASURE_LABELS: Record<Measure, string> = {
  scale: "Échelle",
  nominal: "Nominale",
  ordinal: "Ordinale",
};
const ALIGN_LABELS: Record<Align, string> = { left: "Gauche", center: "Centre", right: "Droite" };
const ROLE_LABELS: Record<Role, string> = { input: "Entrée", target: "Cible", both: "Les deux", none: "Aucun" };

export function VariableView() {
  const variables = useStore((s) => s.variables);
  const updateVariable = useStore((s) => s.updateVariable);
  const renameVariable = useStore((s) => s.renameVariable);
  const removeVariable = useStore((s) => s.removeVariable);
  const addVariable = useStore((s) => s.addVariable);
  const askConfirm = useStore((s) => s.askConfirm);
  const [labelsFor, setLabelsFor] = useState<number | null>(null);

  return (
    <div className="data-panel">
      <div className="sheet-toolbar">
        <button className="ghost" onClick={addVariable}>
          + Nouvelle variable
        </button>
      </div>

      {variables.length === 0 ? (
        <div className="empty">Aucune variable. Créez-en une ou allez saisir des données.</div>
      ) : (
        <div className="grid-wrap">
          <table className="data-grid variable-grid">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Étiquette</th>
                <th>Valeurs</th>
                <th>Manquantes</th>
                <th>Mesure</th>
                <th>Décimales</th>
                <th>Alignement</th>
                <th>Colonnes</th>
                <th>Rôle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v, i) => (
                <tr key={i}>
                  <td>
                    <input defaultValue={v.name} key={v.name} onBlur={(e) => renameVariable(i, e.target.value)} />
                  </td>
                  <td>
                    <select value={v.type} onChange={(e) => updateVariable(i, { type: e.target.value as VarType })}>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t === "numeric" ? "Numérique" : "Chaîne"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={v.label} onChange={(e) => updateVariable(i, { label: e.target.value })} />
                  </td>
                  <td>
                    <button className="cell-btn" onClick={() => setLabelsFor(i)}>
                      {Object.keys(v.labels).length ? `${Object.keys(v.labels).length} étiquette(s)` : "définir…"}
                    </button>
                  </td>
                  <td className="muted-cell">{v.missing.length ? v.missing.join(", ") : "aucune"}</td>
                  <td>
                    <select
                      value={v.measure}
                      onChange={(e) => updateVariable(i, { measure: e.target.value as Measure })}
                    >
                      {MEASURES.map((m) => (
                        <option key={m} value={m}>
                          {MEASURE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={v.decimals}
                      onChange={(e) => updateVariable(i, { decimals: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <select value={v.align} onChange={(e) => updateVariable(i, { align: e.target.value as Align })}>
                      {ALIGNS.map((a) => (
                        <option key={a} value={a}>
                          {ALIGN_LABELS[a]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={v.columns}
                      onChange={(e) => updateVariable(i, { columns: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <select value={v.role} onChange={(e) => updateVariable(i, { role: e.target.value as Role })}>
                      {ROLES.map((rl) => (
                        <option key={rl} value={rl}>
                          {ROLE_LABELS[rl]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="link-btn" title="Supprimer" onClick={() =>
                      askConfirm({ message: `Supprimer la variable « ${v.name} » et toutes ses données ?`, danger: true, confirmLabel: "Supprimer", onConfirm: () => removeVariable(i) })}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {labelsFor !== null && <ValueLabelsDialog index={labelsFor} onClose={() => setLabelsFor(null)} />}
    </div>
  );
}
