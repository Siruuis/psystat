import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import type { Variable } from "../types";

type Goal = "compare" | "link" | "predict" | "scale" | "describe";

interface Plan {
  engine: string;
  title: string;
  testName: string;
  why: string;
  params: Record<string, unknown>;
}

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "compare", label: "Comparer des groupes ou des conditions", hint: "ex. les hommes et les femmes, avant / après" },
  { id: "link", label: "Mesurer un lien entre deux variables", hint: "ex. le stress est-il lié au sommeil ?" },
  { id: "predict", label: "Prédire ou expliquer une variable", hint: "ex. qu'est-ce qui explique la réussite ?" },
  { id: "scale", label: "Analyser une échelle / un questionnaire", hint: "fidélité des items (alpha de Cronbach)" },
  { id: "describe", label: "Décrire mes données", hint: "moyennes, fréquences, dispersion" },
];

export function AssistantDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const execute = useStore((s) => s.execute);

  const byName = useMemo(() => {
    const m: Record<string, Variable> = {};
    variables.forEach((v) => (m[v.name] = v));
    return m;
  }, [variables]);

  const distinct = (name: string) => {
    const s = new Set<string>();
    for (const r of rows) {
      const v = r[name];
      if (v !== null && v !== undefined && v !== "") s.add(String(v));
    }
    return s.size;
  };

  const isQuant = (v?: Variable) => !!v && v.type === "numeric" && v.measure !== "nominal";

  const [goal, setGoal] = useState<Goal | null>(null);
  const [paired, setPaired] = useState<boolean | null>(null);
  const [dv, setDv] = useState("");
  const [group, setGroup] = useState("");
  const [repeated, setRepeated] = useState<string[]>([]);
  const [linkA, setLinkA] = useState("");
  const [linkB, setLinkB] = useState("");
  const [outcome, setOutcome] = useState("");
  const [predictors, setPredictors] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [descVars, setDescVars] = useState<string[]>([]);
  const [forceNonParam, setForceNonParam] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, name: string) =>
    set(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);

  const plan: Plan | { blocked: string } | null = useMemo(() => {
    if (goal === "compare") {
      if (paired === null) return null;
      if (!paired) {
        if (!dv || !group) return null;
        const v = byName[dv];
        const k = distinct(group) || 2;
        const np = forceNonParam || v?.measure === "ordinal";
        if (k <= 2) {
          return np
            ? { engine: "nonparametric", title: "Mann-Whitney", testName: "Test de Mann-Whitney", params: { kind: "mannwhitney", dependent: dv, group },
                why: "Deux groupes indépendants et une variable ordinale ou non normale : le test non-paramétrique de Mann-Whitney est adapté." }
            : { engine: "ttest", title: "Test t pour échantillons indépendants", testName: "Test t de Student (indépendants)", params: { kind: "independent", dependent: dv, group },
                why: "Deux groupes indépendants et une variable quantitative : le test t pour échantillons indépendants est le test classique." };
        }
        return np
          ? { engine: "nonparametric", title: "Kruskal-Wallis", testName: "Test de Kruskal-Wallis", params: { kind: "kruskal", dependent: dv, group },
              why: "Trois groupes ou plus et une variable ordinale ou non normale : Kruskal-Wallis est la version non-paramétrique de l'ANOVA." }
          : { engine: "anova", title: "ANOVA à un facteur", testName: "ANOVA à un facteur", params: { kind: "oneway", dependent: dv, factor: group },
              why: "Trois groupes ou plus et une variable quantitative : l'ANOVA à un facteur compare les moyennes." };
      }
      if (repeated.length < 2) return null;
      const np = forceNonParam || repeated.some((n) => byName[n]?.measure === "ordinal");
      if (repeated.length === 2) {
        return np
          ? { engine: "nonparametric", title: "Wilcoxon", testName: "Test de Wilcoxon (appariés)", params: { kind: "wilcoxon", variable1: repeated[0], variable2: repeated[1] },
              why: "Deux mesures sur les mêmes participants, données ordinales ou non normales : le test de Wilcoxon est adapté." }
          : { engine: "ttest", title: "Test t pour échantillons appariés", testName: "Test t pour échantillons appariés", params: { kind: "paired", variable1: repeated[0], variable2: repeated[1] },
              why: "Deux mesures sur les mêmes participants (ex. avant / après) : le test t apparié est le test classique." };
      }
      return np
        ? { engine: "nonparametric", title: "Friedman", testName: "Test de Friedman", params: { kind: "friedman", within: repeated },
            why: "Trois mesures ou plus sur les mêmes participants, données ordinales ou non normales : le test de Friedman est adapté." }
        : { engine: "anova", title: "ANOVA à mesures répétées", testName: "ANOVA à mesures répétées", params: { kind: "repeated", within: repeated },
            why: "Trois mesures ou plus sur les mêmes participants : l'ANOVA à mesures répétées compare les conditions." };
    }

    if (goal === "link") {
      if (!linkA || !linkB || linkA === linkB) return null;
      const a = byName[linkA];
      const b = byName[linkB];
      const quantA = isQuant(a);
      const quantB = isQuant(b);
      if (quantA && quantB) {
        const spearman = a.measure === "ordinal" || b.measure === "ordinal" || forceNonParam;
        return spearman
          ? { engine: "correlation", title: "Corrélation de Spearman", testName: "Corrélation de Spearman", params: { variables: [linkA, linkB], method: "spearman" },
              why: "Deux variables quantitatives dont au moins une ordinale ou non normale : la corrélation de Spearman (sur les rangs) est adaptée." }
          : { engine: "correlation", title: "Corrélation de Pearson", testName: "Corrélation de Pearson", params: { variables: [linkA, linkB], method: "pearson" },
              why: "Deux variables quantitatives : la corrélation de Pearson mesure la force et le sens du lien linéaire." };
      }
      if (a?.measure === "nominal" && b?.measure === "nominal") {
        return { engine: "crosstabs", title: "Tableau croisé (Khi²)", testName: "Test du Khi-deux d'indépendance", params: { row: linkA, column: linkB },
          why: "Deux variables catégorielles : le test du Khi-deux vérifie si elles sont liées." };
      }
      return { blocked: "Une variable est quantitative et l'autre catégorielle : utilisez plutôt « Comparer des groupes » (la variable catégorielle définit les groupes)." };
    }

    if (goal === "predict") {
      if (!outcome || predictors.length === 0) return null;
      const binary = distinct(outcome) <= 2;
      return binary
        ? { engine: "regression", title: "Régression logistique binaire", testName: "Régression logistique", params: { kind: "logistic", dependent: outcome, predictors },
            why: "La variable à expliquer a deux modalités (0/1) : la régression logistique estime la probabilité de l'issue." }
        : { engine: "regression", title: "Régression linéaire", testName: "Régression linéaire multiple", params: { kind: "linear", dependent: outcome, predictors },
            why: "La variable à expliquer est quantitative : la régression linéaire estime son lien avec les prédicteurs." };
    }

    if (goal === "scale") {
      if (items.length < 2) return null;
      return { engine: "reliability", title: "Analyse de fiabilité", testName: "Alpha de Cronbach / oméga", params: { items },
        why: "Plusieurs items censés mesurer un même construit : l'alpha de Cronbach évalue leur cohérence interne." };
    }

    if (goal === "describe") {
      if (descVars.length === 0) return null;
      const allNum = descVars.every((n) => byName[n]?.type === "numeric");
      return allNum
        ? { engine: "descriptives", title: "Descriptives", testName: "Statistiques descriptives", params: { variables: descVars },
            why: "Variables quantitatives : moyennes, écarts-types et dispersion." }
        : { engine: "frequencies", title: "Fréquences", testName: "Tableau de fréquences", params: { variables: descVars },
            why: "Variables catégorielles : effectifs et pourcentages de chaque modalité." };
    }
    return null;
  }, [goal, paired, dv, group, repeated, linkA, linkB, outcome, predictors, items, descVars, forceNonParam, byName, rows]);

  const launch = () => {
    if (plan && !("blocked" in plan)) {
      execute(plan.engine, plan.title, plan.params);
      onDone();
    }
  };

  const varSelect = (value: string, set: (v: string) => void, filter?: (v: Variable) => boolean) => (
    <select value={value} onChange={(e) => set(e.target.value)}>
      <option value="">-- choisir --</option>
      {variables.filter((v) => (filter ? filter(v) : true)).map((v) => (
        <option key={v.name} value={v.name} title={v.name}>
          {v.label || v.name}
        </option>
      ))}
    </select>
  );

  const varMulti = (list: string[], set: (v: string[]) => void, filter?: (v: Variable) => boolean) => (
    <div className="var-list">
      {variables.filter((v) => (filter ? filter(v) : true)).map((v) => (
        <label key={v.name} className={`var-item ${list.includes(v.name) ? "on" : ""}`} title={v.name}>
          <input type="checkbox" checked={list.includes(v.name)} onChange={() => toggle(list, set, v.name)} />
          <span className="var-name">{v.label || v.name}</span>
        </label>
      ))}
    </div>
  );

  const resetFrom = () => {
    setPaired(null); setDv(""); setGroup(""); setRepeated([]);
    setLinkA(""); setLinkB(""); setOutcome(""); setPredictors([]);
    setItems([]); setDescVars([]); setForceNonParam(false);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog assistant-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Assistant d'analyse</h2>
          <p className="assistant-sub">Réponds à quelques questions, je choisis le bon test et je le lance.</p>
        </div>

        <div className="dialog-body">
          {!goal && (
            <div className="assistant-goals">
              {GOALS.map((g) => (
                <button key={g.id} className="assistant-goal" onClick={() => { resetFrom(); setGoal(g.id); }}>
                  <span className="assistant-goal-label">{g.label}</span>
                  <span className="assistant-goal-hint">{g.hint}</span>
                </button>
              ))}
            </div>
          )}

          {goal === "compare" && (
            <>
              <div className="field">
                <label className="field-label">Les mesures viennent-elles des mêmes participants ?</label>
                <div className="radio-row">
                  <label className="opt-row"><input type="radio" checked={paired === false} onChange={() => setPaired(false)} /> <span>Non, ce sont des groupes différents</span></label>
                  <label className="opt-row"><input type="radio" checked={paired === true} onChange={() => setPaired(true)} /> <span>Oui, mêmes participants (avant / après…)</span></label>
                </div>
              </div>
              {paired === false && (
                <>
                  <div className="field"><label className="field-label">Variable à comparer (quantitative)</label>{varSelect(dv, setDv, (v) => v.type === "numeric")}</div>
                  <div className="field"><label className="field-label">Variable qui définit les groupes</label>{varSelect(group, setGroup)}</div>
                </>
              )}
              {paired === true && (
                <div className="field">
                  <label className="field-label">Les mesures répétées (au moins 2)</label>
                  {varMulti(repeated, setRepeated, (v) => v.type === "numeric")}
                </div>
              )}
            </>
          )}

          {goal === "link" && (
            <>
              <div className="field"><label className="field-label">Première variable</label>{varSelect(linkA, setLinkA)}</div>
              <div className="field"><label className="field-label">Deuxième variable</label>{varSelect(linkB, setLinkB)}</div>
            </>
          )}

          {goal === "predict" && (
            <>
              <div className="field"><label className="field-label">Variable à expliquer</label>{varSelect(outcome, setOutcome, (v) => v.type === "numeric")}</div>
              <div className="field"><label className="field-label">Prédicteurs (une ou plusieurs)</label>{varMulti(predictors, setPredictors, (v) => v.type === "numeric" && v.name !== outcome)}</div>
            </>
          )}

          {goal === "scale" && (
            <div className="field"><label className="field-label">Items de l'échelle</label>{varMulti(items, setItems, (v) => v.type === "numeric")}</div>
          )}

          {goal === "describe" && (
            <div className="field"><label className="field-label">Variables à décrire</label>{varMulti(descVars, setDescVars)}</div>
          )}

          {goal && (goal === "compare" || goal === "link") && (
            <label className="opt-row assistant-np">
              <input type="checkbox" checked={forceNonParam} onChange={(e) => setForceNonParam(e.target.checked)} />
              <span>Mes données ne suivent pas une loi normale (utiliser un test non-paramétrique)</span>
            </label>
          )}

          {plan && "blocked" in plan && <div className="assistant-blocked">{plan.blocked}</div>}

          {plan && !("blocked" in plan) && (
            <div className="assistant-reco">
              <div className="assistant-reco-head">Test recommandé</div>
              <div className="assistant-reco-name">{plan.testName}</div>
              <div className="assistant-reco-why">{plan.why}</div>
            </div>
          )}
        </div>

        <div className="dialog-actions">
          {goal && (
            <button className="ghost" onClick={() => setGoal(null)}>
              ← Changer d'objectif
            </button>
          )}
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>Annuler</button>
          <button className="primary" disabled={!plan || "blocked" in plan} onClick={launch}>
            Lancer l'analyse
          </button>
        </div>
      </div>
    </div>
  );
}
