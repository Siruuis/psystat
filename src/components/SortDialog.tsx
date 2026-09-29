import { useState } from "react";
import { useStore } from "../state/store";

export function SortDialog({ onClose }: { onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const sortByColumn = useStore((s) => s.sortByColumn);
  const [variable, setVariable] = useState(variables[0]?.name ?? "");
  const [ascending, setAscending] = useState(true);

  const submit = () => {
    const index = variables.findIndex((v) => v.name === variable);
    if (index >= 0) sortByColumn(index, ascending);
    onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h2>Trier les observations</h2>
        <div className="dialog-body">
          <div className="field">
            <label>Trier selon</label>
            <select value={variable} onChange={(e) => setVariable(e.target.value)}>
              {variables.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.label || v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ordre</label>
            <select value={ascending ? "asc" : "desc"} onChange={(e) => setAscending(e.target.value === "asc")}>
              <option value="asc">Croissant</option>
              <option value="desc">Décroissant</option>
            </select>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" onClick={submit}>
            Trier
          </button>
        </div>
      </div>
    </div>
  );
}
