import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { runTransform } from "../lib/engine";

export type RecodeMode = "same" | "new";

type Kind = "value" | "range" | "missing" | "else";

interface Rule {
  kind: Kind;
  from: string;
  toValue: string;
  to: string;
}

const KINDS: { value: Kind; label: string }[] = [
  { value: "value", label: "Valeur" },
  { value: "range", label: "Plage" },
  { value: "missing", label: "Manquante" },
  { value: "else", label: "Toutes les autres" },
];

const emptyRule = (): Rule => ({ kind: "value", from: "", toValue: "", to: "" });

export function RecodeDialog({ onClose, initialMode = "new" }: { onClose: () => void; initialMode?: RecodeMode }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const applyColumns = useStore((s) => s.applyColumns);
  const setNotice = useStore((s) => s.setNotice);

  const [mode, setMode] = useState<RecodeMode>(initialMode);
  const [suffix, setSuffix] = useState("_r");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<Rule[]>([emptyRule()]);
  const [likertMin, setLikertMin] = useState("1");
  const [likertMax, setLikertMax] = useState("5");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? variables.filter((v) => v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)) : variables;
  }, [variables, search]);

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const setRule = (i: number, patch: Partial<Rule>) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const invertScale = () => {
    const lo = Number(likertMin);
    const hi = Number(likertMax);
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi <= lo) {
      setNotice("Indiquez une échelle valide (ex : de 1 à 5).");
      return;
    }
    const generated: Rule[] = [];
    for (let k = lo; k <= hi; k++) generated.push({ kind: "value", from: String(k), toValue: "", to: String(lo + hi - k) });
    setRules(generated);
  };

  const targetName = (src: string) => (mode === "same" ? src : `${src}${suffix}`);
  const collisions = mode === "new" ? selected.filter((s) => variables.some((v) => v.name === targetName(s))) : [];

  const cleanRules = rules
    .filter((r) => r.kind === "missing" || r.kind === "else" || r.from.trim() !== "" || (r.kind === "range" && r.toValue.trim() !== ""))
    .map((r) => ({
      kind: r.kind,
      from: r.from.trim(),
      to_value: r.toValue.trim(),
      to: r.to.trim() === "" ? null : isNaN(Number(r.to)) ? r.to.trim() : Number(r.to),
    }));

  const valid = selected.length > 0 && cleanRules.length > 0 && (mode === "same" || suffix.trim() !== "");

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const res = await runTransform("recode", variables, rows, { sources: selected, rules: cleanRules, keep_else: true });
      if (res.error) setNotice(res.error);
      else if (res.columns) {
        applyColumns(selected.map((src) => ({ name: targetName(src), values: res.columns![src], from: src })));
        setNotice(
          mode === "same"
            ? `${selected.length} variable(s) recodée(s). Ctrl+Z pour annuler.`
            : `${selected.length} nouvelle(s) variable(s) créée(s) (suffixe « ${suffix} »).`
        );
        onClose();
      }
    } catch (e) {
      setNotice(String(e));
    }
    setBusy(false);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog recode-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Recoder des variables</h2>
        </div>
        <div className="dialog-body">
          <div className="radio-row">
            <label className="opt-row">
              <input type="radio" checked={mode === "same"} onChange={() => setMode("same")} />
              <span>Dans les mêmes variables</span>
            </label>
            <label className="opt-row">
              <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
              <span>Dans de nouvelles variables</span>
            </label>
            {mode === "new" && (
              <label className="recode-suffix">
                suffixe <input value={suffix} onChange={(e) => setSuffix(e.target.value)} />
              </label>
            )}
          </div>

          <div className="recode-cols">
            <div className="field">
              <label className="field-label">
                Variables <span className="field-count">{selected.length ? `· ${selected.length} sélectionnée(s)` : ""}</span>
              </label>
              <input className="recode-search" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="var-list">
                {visible.map((v) => (
                  <label key={v.name} className={`var-item ${selected.includes(v.name) ? "on" : ""}`} title={v.name}>
                    <input type="checkbox" checked={selected.includes(v.name)} onChange={() => toggle(v.name)} />
                    <span className="var-name">{v.label || v.name}</span>
                  </label>
                ))}
              </div>
              <div className="recode-quick">
                <button className="link-btn" onClick={() => setSelected(Array.from(new Set([...selected, ...visible.map((v) => v.name)])))}>
                  tout cocher
                </button>
                <button className="link-btn" onClick={() => setSelected([])}>
                  aucune
                </button>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Inverser une échelle (items inversés)</label>
              <div className="recode-likert">
                de <input value={likertMin} onChange={(e) => setLikertMin(e.target.value)} />
                à <input value={likertMax} onChange={(e) => setLikertMax(e.target.value)} />
                <button className="ghost" onClick={invertScale}>Générer les règles</button>
              </div>

              <label className="field-label">Anciennes valeurs → nouvelles valeurs</label>
              <div className="recode-rules">
                {rules.map((r, i) => (
                  <div className="recode-rule" key={i}>
                    <select value={r.kind} onChange={(e) => setRule(i, { kind: e.target.value as Kind })}>
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                    {r.kind === "value" && <input placeholder="valeur" value={r.from} onChange={(e) => setRule(i, { from: e.target.value })} />}
                    {r.kind === "range" && (
                      <>
                        <input placeholder="min" title="vide = la plus petite" value={r.from} onChange={(e) => setRule(i, { from: e.target.value })} />
                        <span className="recode-to">à</span>
                        <input placeholder="max" title="vide = la plus grande" value={r.toValue} onChange={(e) => setRule(i, { toValue: e.target.value })} />
                      </>
                    )}
                    <span className="pair-arrow">→</span>
                    <input placeholder="manquante" value={r.to} onChange={(e) => setRule(i, { to: e.target.value })} />
                    <button className="link-btn" onClick={() => setRules((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : [emptyRule()]))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="ghost" onClick={() => setRules((p) => [...p, emptyRule()])}>
                + Ajouter une règle
              </button>
              <p className="hint">Les valeurs non couvertes par une règle sont conservées. Laisser la nouvelle valeur vide la rend manquante.</p>
            </div>
          </div>

          {collisions.length > 0 && (
            <div className="recode-warn">
              Déjà existante(s), sera(ont) remplacée(s) : {collisions.map(targetName).join(", ")}
            </div>
          )}
        </div>
        <div className="dialog-actions">
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={busy || !valid} onClick={submit}>
            {busy ? "Recodage…" : selected.length > 1 ? `Recoder ${selected.length} variables` : "Recoder"}
          </button>
        </div>
      </div>
    </div>
  );
}
