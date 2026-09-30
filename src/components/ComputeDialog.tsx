import { useMemo, useRef, useState } from "react";
import { useStore } from "../state/store";
import { runTransform } from "../lib/engine";

interface Fn {
  label: string;
  insert: string;
  caretBack?: number;
  desc: string;
}

const GROUPS: Record<string, Fn[]> = {
  Arithmétique: [
    { label: "Abs(x)", insert: "abs()", caretBack: 1, desc: "Valeur absolue" },
    { label: "Rnd(x)", insert: "round()", caretBack: 1, desc: "Arrondi à l'entier" },
    { label: "Trunc(x)", insert: "trunc()", caretBack: 1, desc: "Troncature" },
    { label: "Mod(x, y)", insert: "mod(, )", caretBack: 3, desc: "Reste de la division" },
    { label: "Sqrt(x)", insert: "sqrt()", caretBack: 1, desc: "Racine carrée" },
    { label: "Exp(x)", insert: "exp()", caretBack: 1, desc: "Exponentielle" },
    { label: "Ln(x)", insert: "ln()", caretBack: 1, desc: "Logarithme népérien" },
    { label: "Lg10(x)", insert: "lg10()", caretBack: 1, desc: "Logarithme base 10" },
  ],
  Statistiques: [
    { label: "Mean(x, …)", insert: "mean(, )", caretBack: 3, desc: "Moyenne (ignore les manquantes)" },
    { label: "Sum(x, …)", insert: "sum(, )", caretBack: 3, desc: "Somme" },
    { label: "Sd(x, …)", insert: "sd(, )", caretBack: 3, desc: "Écart-type" },
    { label: "Variance(x, …)", insert: "variance(, )", caretBack: 3, desc: "Variance" },
    { label: "Median(x, …)", insert: "median(, )", caretBack: 3, desc: "Médiane" },
    { label: "Min(x, …)", insert: "min(, )", caretBack: 3, desc: "Minimum" },
    { label: "Max(x, …)", insert: "max(, )", caretBack: 3, desc: "Maximum" },
  ],
  Trigonométrie: [
    { label: "Sin(x)", insert: "sin()", caretBack: 1, desc: "Sinus (radians)" },
    { label: "Cos(x)", insert: "cos()", caretBack: 1, desc: "Cosinus (radians)" },
    { label: "Tan(x)", insert: "tan()", caretBack: 1, desc: "Tangente (radians)" },
    { label: "Arsin(x)", insert: "arsin()", caretBack: 1, desc: "Arc sinus" },
    { label: "Artan(x)", insert: "artan()", caretBack: 1, desc: "Arc tangente" },
  ],
};

const KEYS: { label: string; insert: string; wide?: boolean; op?: boolean }[] = [
  { label: "+", insert: "+", op: true }, { label: "<", insert: "<", op: true }, { label: ">", insert: ">", op: true },
  { label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" },
  { label: "-", insert: "-", op: true }, { label: "<=", insert: "<=", op: true }, { label: ">=", insert: ">=", op: true },
  { label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" },
  { label: "*", insert: "*", op: true }, { label: "=", insert: "==", op: true }, { label: "!=", insert: "!=", op: true },
  { label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" },
  { label: "/", insert: "/", op: true }, { label: "&", insert: " & ", op: true }, { label: "|", insert: " | ", op: true },
  { label: "0", insert: "0" }, { label: ".", insert: "." }, { label: "( )", insert: "()" },
  { label: "**", insert: "**", op: true }, { label: "Suppr", insert: "__DEL__", op: true, wide: true },
];

export function ComputeDialog({ onClose }: { onClose: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const addComputedColumn = useStore((s) => s.addComputedColumn);
  const setNotice = useStore((s) => s.setNotice);

  const [name, setName] = useState("nouvelle_var");
  const [expr, setExpr] = useState("");
  const [condition, setCondition] = useState("");
  const [group, setGroup] = useState("Tous");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<"expr" | "cond">("expr");
  const exprRef = useRef<HTMLTextAreaElement>(null);
  const condRef = useRef<HTMLInputElement>(null);

  const functions = useMemo(() => {
    if (group === "Tous") return Object.values(GROUPS).flat();
    return GROUPS[group] ?? [];
  }, [group]);

  const insert = (text: string, caretBack = 0) => {
    const isExpr = active === "expr";
    const el = isExpr ? exprRef.current : condRef.current;
    const val = isExpr ? expr : condition;
    const setVal = isExpr ? setExpr : setCondition;
    const start = el?.selectionStart ?? val.length;
    const end = el?.selectionEnd ?? val.length;
    if (text === "__DEL__") {
      const next = start === end ? val.slice(0, Math.max(0, start - 1)) + val.slice(end) : val.slice(0, start) + val.slice(end);
      setVal(next);
      const pos = start === end ? Math.max(0, start - 1) : start;
      requestAnimationFrame(() => el?.setSelectionRange(pos, pos));
      return;
    }
    const next = val.slice(0, start) + text + val.slice(end);
    setVal(next);
    requestAnimationFrame(() => {
      const pos = start + text.length - caretBack;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    if (!name.trim() || !expr.trim()) return;
    setBusy(true);
    try {
      const res = await runTransform("compute", variables, rows, {
        expression: expr,
        name: name.trim(),
        condition: condition.trim() || undefined,
      });
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
      <div className="dialog compute-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Calculer une variable</h2>
        </div>
        <div className="dialog-body">
          <div className="compute-target">
            <label className="field-label">Variable cible</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <span className="compute-eq">=</span>
            <label className="field-label expr-label">Expression numérique</label>
          </div>

          <div className="compute-cols">
            <div className="compute-varlist">
              {variables.map((v) => (
                <button key={v.name} className="var-row" title={v.name} onDoubleClick={() => insert(v.name)} onClick={() => insert(v.name)}>
                  {v.label || v.name}
                </button>
              ))}
              {variables.length === 0 && <div className="var-empty">Aucune variable</div>}
            </div>

            <div className="compute-center">
              <textarea
                ref={exprRef}
                className="compute-expr"
                value={expr}
                onFocus={() => setActive("expr")}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="ex : (pre + post) / 2   ·   mean(q1, q2, q3)"
              />
              <div className="compute-keypad">
                {KEYS.map((k, i) => (
                  <button
                    key={i}
                    className={`key ${k.op ? "op" : ""} ${k.wide ? "wide" : ""} ${k.label === "Suppr" ? "del" : ""}`}
                    onClick={() => insert(k.insert, k.insert === "()" ? 1 : 0)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="compute-right">
              <label className="field-label">Groupe de fonctions</label>
              <div className="compute-groups">
                {["Tous", ...Object.keys(GROUPS)].map((g) => (
                  <button key={g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>
                    {g}
                  </button>
                ))}
              </div>
              <label className="field-label">Fonctions</label>
              <div className="compute-funcs">
                {functions.map((f) => (
                  <button key={f.label} title={f.desc} onClick={() => insert(f.insert, f.caretBack ?? 0)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="compute-condition">
            <span className="field-label">Si… (condition facultative)</span>
            <input
              ref={condRef}
              value={condition}
              onFocus={() => setActive("cond")}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="ex : age >= 18 & groupe == 1"
            />
          </div>
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={() => { setExpr(""); setCondition(""); }}>
            Réinitialiser
          </button>
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={busy || !name.trim() || !expr.trim()} onClick={submit}>
            {busy ? "Calcul…" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
