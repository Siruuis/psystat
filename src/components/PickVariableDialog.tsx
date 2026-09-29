import { useState } from "react";
import { useStore } from "../state/store";

export function PickVariableDialog({
  title,
  label,
  current,
  onChoose,
  onClose,
  filter,
}: {
  title: string;
  label: string;
  current: string | null;
  onChoose: (name: string | null) => void;
  onClose: () => void;
  filter?: (name: string) => boolean;
}) {
  const variables = useStore((s) => s.variables);
  const [value, setValue] = useState(current ?? "");
  const list = variables.filter((v) => (filter ? filter(v.name) : true));

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{title}</h2>
        </div>
        <div className="dialog-body">
          <div className="field">
            <label className="field-label">{label}</label>
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">(aucune)</option>
              {list.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.label ? `${v.name} (${v.label})` : v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="dialog-actions">
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" onClick={() => { onChoose(value || null); onClose(); }}>
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
