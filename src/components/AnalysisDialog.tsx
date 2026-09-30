import { useMemo, useState, type ReactNode } from "react";
import type { AnalysisDef, Field } from "../lib/analyses";
import { useStore } from "../state/store";

export function AnalysisDialog({ def, onClose }: { def: AnalysisDef; onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const execute = useStore((s) => s.execute);
  const [showOptions, setShowOptions] = useState(false);

  const allFields = useMemo(() => [...def.fields, ...(def.options ?? [])], [def]);

  const initial = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const f of allFields) {
      if (f.kind === "variables") values[f.key] = [];
      else if (f.kind === "checkbox") values[f.key] = f.default ?? false;
      else if (f.default !== undefined) values[f.key] = f.default;
      else values[f.key] = "";
    }
    return values;
  }, [allFields]);

  const [values, setValues] = useState<Record<string, unknown>>(initial);

  const varOptions = (f: Field) => variables.filter((v) => (f.filter ? f.filter(v) : true));
  const set = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }));
  const toggleMulti = (key: string, name: string) =>
    setValues((prev) => {
      const list = (prev[key] as string[]) ?? [];
      return { ...prev, [key]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name] };
    });

  const valid = def.fields.every((f) => {
    if (f.optional || f.kind === "checkbox" || f.kind === "radio") return true;
    const v = values[f.key];
    if (f.kind === "variables") return Array.isArray(v) && v.length > 0;
    if (f.kind === "number") return v !== "" && v !== null;
    return v !== "" && v !== undefined;
  });

  const submit = () => {
    const clean: Record<string, unknown> = {};
    for (const f of allFields) {
      const v = values[f.key];
      if (f.optional && (v === "" || v === undefined || (Array.isArray(v) && v.length === 0))) continue;
      clean[f.key] = v;
    }
    execute(def.engine, def.title, { ...(def.staticParams ?? {}), ...clean });
    onClose();
  };

  const renderField = (f: Field) => {
    if (f.kind === "checkbox") {
      return (
        <label className="opt-row" key={f.key}>
          <input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
          <span>{f.label}</span>
        </label>
      );
    }
    if (f.kind === "radio") {
      return (
        <div className="field" key={f.key}>
          <label className="field-label">{f.label}</label>
          <div className="radio-row">
            {f.options?.map((o) => (
              <label className="opt-row" key={o.value}>
                <input type="radio" name={f.key} checked={values[f.key] === o.value} onChange={() => set(f.key, o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (f.kind === "variables") {
      const selected = (values[f.key] as string[]) ?? [];
      return (
        <div className="field" key={f.key}>
          <label className="field-label">
            {f.label} <span className="field-count">{selected.length ? `· ${selected.length} sélectionnée(s)` : ""}</span>
          </label>
          <div className="var-list">
            {varOptions(f).map((v) => (
              <label key={v.name} className={`var-item ${selected.includes(v.name) ? "on" : ""}`} title={v.name}>
                <input type="checkbox" checked={selected.includes(v.name)} onChange={() => toggleMulti(f.key, v.name)} />
                <span className="var-name">{v.label || v.name}</span>
              </label>
            ))}
            {varOptions(f).length === 0 && <div className="var-empty">Aucune variable compatible.</div>}
          </div>
        </div>
      );
    }
    return (
      <div className="field" key={f.key}>
        <label className="field-label">{f.label}</label>
        {f.kind === "variable" && (
          <select value={values[f.key] as string} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">-- choisir --</option>
            {varOptions(f).map((v) => (
              <option key={v.name} value={v.name} title={v.name}>
                {v.label || v.name}
              </option>
            ))}
          </select>
        )}
        {f.kind === "select" && (
          <select value={values[f.key] as string} onChange={(e) => set(f.key, e.target.value)}>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {f.kind === "number" && (
          <input type="number" value={values[f.key] as number}
            onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))} />
        )}
      </div>
    );
  };

  const renderFields = (fields: Field[]) => {
    const out: ReactNode[] = [];
    let i = 0;
    while (i < fields.length) {
      const sec = fields[i].section;
      if (sec) {
        const group: Field[] = [];
        while (i < fields.length && fields[i].section === sec) group.push(fields[i++]);
        out.push(
          <fieldset className="field-section" key={sec + i}>
            <legend>{sec}</legend>
            {group.map(renderField)}
          </fieldset>
        );
      } else {
        out.push(renderField(fields[i]));
        i++;
      }
    }
    return out;
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog analysis-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{def.title}</h2>
        </div>
        <div className="dialog-body">{renderFields(def.fields)}</div>
        <div className="dialog-actions">
          {def.options && (
            <button className="ghost" onClick={() => setShowOptions(true)}>
              Options…
            </button>
          )}
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={!valid} onClick={submit}>
            Lancer l'analyse
          </button>
        </div>

        {showOptions && def.options && (
          <div className="dialog-backdrop nested" onClick={() => setShowOptions(false)}>
            <div className="dialog options-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-head">
                <h2>Options — {def.title}</h2>
              </div>
              <div className="dialog-body">{renderFields(def.options)}</div>
              <div className="dialog-actions">
                <div className="spacer" />
                <button className="primary" onClick={() => setShowOptions(false)}>
                  Poursuivre
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
