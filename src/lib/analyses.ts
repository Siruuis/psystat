import type { Variable } from "../types";

export interface Field {
  key: string;
  label: string;
  kind: "variable" | "variables" | "select" | "number" | "checkbox" | "radio";
  filter?: (v: Variable) => boolean;
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  optional?: boolean;
  section?: string;
}

export interface AnalysisDef {
  id: string;
  group: string;
  title: string;
  engine: string;
  fields: Field[];
  options?: Field[];
  staticParams?: Record<string, unknown>;
}

const isNumeric = (v: Variable) => v.type === "numeric";

export const GRAPH_GROUP = "Graphiques";

export const ANALYSES: AnalysisDef[] = [
  { id: "frequencies", group: "Statistiques descriptives", title: "Fréquences", engine: "frequencies",
    fields: [{ key: "variables", label: "Variables", kind: "variables" }] },
  { id: "descriptives", group: "Statistiques descriptives", title: "Descriptives", engine: "descriptives",
    fields: [{ key: "variables", label: "Variables", kind: "variables", filter: isNumeric }],
    options: [
      { key: "stat_mean", label: "Moyenne", kind: "checkbox", default: true, section: "Tendance centrale et dispersion" },
      { key: "stat_sem", label: "Erreur standard de la moyenne", kind: "checkbox", default: false, section: "Tendance centrale et dispersion" },
      { key: "stat_median", label: "Médiane", kind: "checkbox", default: true, section: "Tendance centrale et dispersion" },
      { key: "stat_sd", label: "Écart-type", kind: "checkbox", default: true, section: "Tendance centrale et dispersion" },
      { key: "stat_variance", label: "Variance", kind: "checkbox", default: false, section: "Tendance centrale et dispersion" },
      { key: "stat_min", label: "Minimum", kind: "checkbox", default: true, section: "Tendance centrale et dispersion" },
      { key: "stat_max", label: "Maximum", kind: "checkbox", default: true, section: "Tendance centrale et dispersion" },
      { key: "stat_range", label: "Étendue", kind: "checkbox", default: false, section: "Tendance centrale et dispersion" },
      { key: "stat_skew", label: "Asymétrie (skewness)", kind: "checkbox", default: true, section: "Distribution" },
      { key: "stat_kurt", label: "Aplatissement (kurtosis)", kind: "checkbox", default: true, section: "Distribution" },
      { key: "normality", label: "Test de normalité (Shapiro-Wilk)", kind: "checkbox", default: true, section: "Distribution" },
    ] },
  { id: "explore", group: "Statistiques descriptives", title: "Explorer", engine: "explore",
    fields: [
      { key: "variables", label: "Variables dépendantes", kind: "variables", filter: isNumeric },
      { key: "factor", label: "Facteur (optionnel)", kind: "variable", optional: true },
    ] },
  { id: "crosstabs", group: "Statistiques descriptives", title: "Tableaux croisés (Khi²)", engine: "crosstabs",
    fields: [
      { key: "row", label: "Variable en ligne", kind: "variable" },
      { key: "column", label: "Variable en colonne", kind: "variable" },
    ] },

  { id: "means", group: "Comparer les moyennes", title: "Moyennes", engine: "means",
    fields: [
      { key: "dependents", label: "Variables dépendantes", kind: "variables", filter: isNumeric },
      { key: "factor", label: "Variable de regroupement", kind: "variable" },
    ] },
  { id: "ttest_one", group: "Comparer les moyennes", title: "Test t pour échantillon unique", engine: "ttest",
    staticParams: { kind: "one_sample" },
    fields: [
      { key: "variable", label: "Variable testée", kind: "variable", filter: isNumeric },
      { key: "popmean", label: "Valeur test", kind: "number", default: 0 },
    ] },
  { id: "ttest_ind", group: "Comparer les moyennes", title: "Test t pour échantillons indépendants", engine: "ttest",
    staticParams: { kind: "independent" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "group", label: "Variable de groupe (2 modalités)", kind: "variable" },
    ] },
  { id: "ttest_paired", group: "Comparer les moyennes", title: "Test t pour échantillons appariés", engine: "ttest",
    staticParams: { kind: "paired" },
    fields: [
      { key: "variable1", label: "Variable 1", kind: "variable", filter: isNumeric },
      { key: "variable2", label: "Variable 2", kind: "variable", filter: isNumeric },
    ] },
  { id: "anova_oneway", group: "Comparer les moyennes", title: "ANOVA à un facteur", engine: "anova",
    staticParams: { kind: "oneway" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "factor", label: "Facteur (groupe)", kind: "variable" },
    ],
    options: [
      { key: "post_hoc", label: "Test post-hoc", kind: "radio", default: "tukey", options: [
        { value: "tukey", label: "Tukey HSD" }, { value: "bonf", label: "Bonferroni" },
        { value: "holm", label: "Holm" }, { value: "sidak", label: "Šidák" }, { value: "none", label: "Aucun" }] },
      { key: "show_descriptives", label: "Statistiques descriptives", kind: "checkbox", default: true, section: "Afficher" },
      { key: "levene", label: "Test d'homogénéité des variances (Levene)", kind: "checkbox", default: false, section: "Afficher" },
    ] },

  { id: "anova_factorial", group: "Modèle linéaire général", title: "ANOVA factorielle (univarié)", engine: "anova",
    staticParams: { kind: "factorial" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "factors", label: "Facteurs fixes", kind: "variables" },
    ] },
  { id: "anova_repeated", group: "Modèle linéaire général", title: "ANOVA à mesures répétées", engine: "anova",
    staticParams: { kind: "repeated" },
    fields: [{ key: "within", label: "Conditions (mesures répétées)", kind: "variables", filter: isNumeric }] },
  { id: "ancova", group: "Modèle linéaire général", title: "ANCOVA (analyse de covariance)", engine: "anova",
    staticParams: { kind: "ancova" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "factor", label: "Facteur", kind: "variable" },
      { key: "covariates", label: "Covariable(s)", kind: "variables", filter: isNumeric },
    ] },

  { id: "correlation", group: "Corrélation", title: "Corrélations bivariées", engine: "correlation",
    fields: [
      { key: "variables", label: "Variables", kind: "variables", filter: isNumeric },
      { key: "method_pearson", label: "Pearson", kind: "checkbox", default: true, section: "Coefficients de corrélation" },
      { key: "method_kendall", label: "Kendall (tau-b)", kind: "checkbox", default: false, section: "Coefficients de corrélation" },
      { key: "method_spearman", label: "Spearman", kind: "checkbox", default: false, section: "Coefficients de corrélation" },
      { key: "tail", label: "Test de signification", kind: "radio", default: "two", options: [
        { value: "two", label: "Bilatéral" }, { value: "one", label: "Unilatéral" }] },
      { key: "flag_significant", label: "Marquer les corrélations significatives", kind: "checkbox", default: true },
    ],
    options: [
      { key: "show_descriptives", label: "Moyennes et écarts-types", kind: "checkbox", default: false },
      { key: "missing", label: "Valeurs manquantes", kind: "radio", default: "pairwise", options: [
        { value: "pairwise", label: "Exclure paire par paire" }, { value: "listwise", label: "Exclure toute observation incomplète" }] },
    ] },
  { id: "partial_corr", group: "Corrélation", title: "Corrélation partielle", engine: "partial_corr",
    fields: [
      { key: "x", label: "Variable 1", kind: "variable", filter: isNumeric },
      { key: "y", label: "Variable 2", kind: "variable", filter: isNumeric },
      { key: "covariates", label: "Variables de contrôle", kind: "variables", filter: isNumeric },
    ] },

  { id: "regression_linear", group: "Régression", title: "Régression linéaire", engine: "regression",
    staticParams: { kind: "linear" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
    ] },
  { id: "regression_logistic", group: "Régression", title: "Régression logistique binaire", engine: "regression",
    staticParams: { kind: "logistic" },
    fields: [
      { key: "dependent", label: "Variable dépendante (0/1)", kind: "variable", filter: isNumeric },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
    ] },

  { id: "efa", group: "Réduction des dimensions", title: "Analyse factorielle (EFA)", engine: "efa",
    fields: [
      { key: "items", label: "Variables (items)", kind: "variables", filter: isNumeric },
      { key: "n_factors", label: "Nombre de facteurs", kind: "number", default: 2 },
      { key: "rotation", label: "Rotation", kind: "select", default: "varimax",
        options: [{ value: "varimax", label: "Varimax" }, { value: "none", label: "Aucune" }] },
    ] },

  { id: "cluster", group: "Classifier", title: "Nuées dynamiques (K-means)", engine: "cluster",
    fields: [
      { key: "variables", label: "Variables", kind: "variables", filter: isNumeric },
      { key: "k", label: "Nombre de classes", kind: "number", default: 3 },
    ] },

  { id: "reliability", group: "Échelle", title: "Analyse de fiabilité (Cronbach, omega)", engine: "reliability",
    fields: [{ key: "items", label: "Items de l'échelle", kind: "variables", filter: isNumeric }] },

  { id: "np_chi2", group: "Tests non paramétriques", title: "Khi-deux (ajustement)", engine: "nonparametric",
    staticParams: { kind: "chi2_gof" }, fields: [{ key: "variable", label: "Variable", kind: "variable" }] },
  { id: "np_binomial", group: "Tests non paramétriques", title: "Binomial", engine: "nonparametric",
    staticParams: { kind: "binomial" },
    fields: [
      { key: "variable", label: "Variable", kind: "variable" },
      { key: "success_value", label: "Valeur « succès »", kind: "number", default: 1 },
      { key: "test_prop", label: "Proportion test", kind: "number", default: 0.5 },
    ] },
  { id: "np_ks", group: "Tests non paramétriques", title: "Kolmogorov-Smirnov (1 échantillon)", engine: "nonparametric",
    staticParams: { kind: "ks_1sample" }, fields: [{ key: "variable", label: "Variable", kind: "variable", filter: isNumeric }] },
  { id: "np_runs", group: "Tests non paramétriques", title: "Test des séries", engine: "nonparametric",
    staticParams: { kind: "runs" }, fields: [{ key: "variable", label: "Variable", kind: "variable", filter: isNumeric }] },
  { id: "np_mannwhitney", group: "Tests non paramétriques", title: "Mann-Whitney (2 indépendants)", engine: "nonparametric",
    staticParams: { kind: "mannwhitney" },
    fields: [
      { key: "dependent", label: "Variable testée", kind: "variable", filter: isNumeric },
      { key: "group", label: "Variable de groupe (2 modalités)", kind: "variable" },
    ] },
  { id: "np_wilcoxon", group: "Tests non paramétriques", title: "Wilcoxon (2 appariés)", engine: "nonparametric",
    staticParams: { kind: "wilcoxon" },
    fields: [
      { key: "variable1", label: "Variable 1", kind: "variable", filter: isNumeric },
      { key: "variable2", label: "Variable 2", kind: "variable", filter: isNumeric },
    ] },
  { id: "np_kruskal", group: "Tests non paramétriques", title: "Kruskal-Wallis (k indépendants)", engine: "nonparametric",
    staticParams: { kind: "kruskal" },
    fields: [
      { key: "dependent", label: "Variable testée", kind: "variable", filter: isNumeric },
      { key: "group", label: "Variable de groupe", kind: "variable" },
    ] },
  { id: "np_friedman", group: "Tests non paramétriques", title: "Friedman (k appariés)", engine: "nonparametric",
    staticParams: { kind: "friedman" }, fields: [{ key: "within", label: "Conditions", kind: "variables", filter: isNumeric }] },

  { id: "rep_summaries", group: "Rapports", title: "Récapitulatifs des observations", engine: "reports",
    staticParams: { kind: "summaries" },
    fields: [
      { key: "variables", label: "Variables", kind: "variables" },
      { key: "limit", label: "Nombre max d'observations", kind: "number", default: 50 },
    ] },

  { id: "bayes_ttest", group: "Statistiques de Bayes", title: "Test t bayésien (indépendants)", engine: "bayes",
    staticParams: { kind: "ttest" },
    fields: [
      { key: "dependent", label: "Variable testée", kind: "variable", filter: isNumeric },
      { key: "group", label: "Variable de groupe (2 modalités)", kind: "variable" },
    ] },
  { id: "bayes_corr", group: "Statistiques de Bayes", title: "Corrélation bayésienne", engine: "bayes",
    staticParams: { kind: "correlation" },
    fields: [
      { key: "x", label: "Variable 1", kind: "variable", filter: isNumeric },
      { key: "y", label: "Variable 2", kind: "variable", filter: isNumeric },
    ] },

  { id: "manova", group: "Modèle linéaire général", title: "MANOVA (multivarié)", engine: "glm",
    staticParams: { kind: "manova" },
    fields: [
      { key: "dependents", label: "Variables dépendantes", kind: "variables", filter: isNumeric },
      { key: "factor", label: "Facteur", kind: "variable" },
    ] },

  { id: "glm_generalized", group: "Modèles linéaires généralisés", title: "Modèle linéaire généralisé", engine: "glm",
    staticParams: { kind: "generalized" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
      { key: "family", label: "Loi (famille)", kind: "select", default: "gaussian", options: [
        { value: "gaussian", label: "Normale" }, { value: "poisson", label: "Poisson" },
        { value: "gamma", label: "Gamma" }, { value: "binomial", label: "Binomiale" }] },
    ] },

  { id: "glm_mixed", group: "Modèles mixtes", title: "Modèle linéaire mixte", engine: "glm",
    staticParams: { kind: "mixed" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "fixed", label: "Effets fixes", kind: "variables", filter: isNumeric },
      { key: "group", label: "Facteur aléatoire (sujet/groupe)", kind: "variable" },
    ] },

  { id: "reg_multinomial", group: "Régression", title: "Régression multinomiale", engine: "regression",
    staticParams: { kind: "multinomial" },
    fields: [
      { key: "dependent", label: "Variable dépendante (nominale)", kind: "variable" },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
    ] },
  { id: "reg_ordinal", group: "Régression", title: "Régression ordinale", engine: "regression",
    staticParams: { kind: "ordinal" },
    fields: [
      { key: "dependent", label: "Variable dépendante (ordinale)", kind: "variable", filter: isNumeric },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
    ] },
  { id: "reg_poisson", group: "Régression", title: "Régression de Poisson (comptage)", engine: "regression",
    staticParams: { kind: "poisson" },
    fields: [
      { key: "dependent", label: "Variable dépendante (comptage)", kind: "variable", filter: isNumeric },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
    ] },
  { id: "reg_curve", group: "Régression", title: "Estimation de courbe", engine: "regression",
    staticParams: { kind: "curve" },
    fields: [
      { key: "dependent", label: "Variable dépendante", kind: "variable", filter: isNumeric },
      { key: "predictors", label: "Variable indépendante", kind: "variables", filter: isNumeric },
    ] },

  { id: "cls_neural", group: "Réseaux neuronaux", title: "Perceptron multicouche (MLP)", engine: "classify",
    staticParams: { kind: "neural" },
    fields: [
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
      { key: "group", label: "Variable cible", kind: "variable" },
      { key: "hidden", label: "Neurones cachés", kind: "number", default: 8 },
    ] },

  { id: "cls_hierarchical", group: "Classifier", title: "Classification hiérarchique", engine: "classify",
    staticParams: { kind: "hierarchical" },
    fields: [
      { key: "variables", label: "Variables", kind: "variables", filter: isNumeric },
      { key: "k", label: "Nombre de classes", kind: "number", default: 3 },
    ] },
  { id: "cls_discriminant", group: "Classifier", title: "Analyse discriminante", engine: "classify",
    staticParams: { kind: "discriminant" },
    fields: [
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
      { key: "group", label: "Variable de groupe", kind: "variable" },
    ] },
  { id: "cls_knn", group: "Classifier", title: "k plus proches voisins", engine: "classify",
    staticParams: { kind: "knn" },
    fields: [
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
      { key: "group", label: "Variable cible", kind: "variable" },
      { key: "k", label: "Nombre de voisins", kind: "number", default: 5 },
    ] },
  { id: "cls_tree", group: "Classifier", title: "Arbre de décision (CART)", engine: "decision_tree",
    fields: [
      { key: "target", label: "Variable cible", kind: "variable" },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
      { key: "max_depth", label: "Profondeur maximale", kind: "number", default: 3 },
      { key: "mode", label: "Type", kind: "select", default: "classification", options: [
        { value: "classification", label: "Classification" }, { value: "regression", label: "Régression" }] },
    ] },
  { id: "loglinear", group: "Log linéaire", title: "Analyse log-linéaire", engine: "loglinear",
    fields: [{ key: "factors", label: "Facteurs", kind: "variables" }] },

  { id: "dim_pca", group: "Réduction des dimensions", title: "Analyse en composantes principales", engine: "dimension",
    staticParams: { kind: "pca" },
    fields: [{ key: "variables", label: "Variables", kind: "variables", filter: isNumeric }] },
  { id: "dim_correspondence", group: "Réduction des dimensions", title: "Analyse des correspondances", engine: "dimension",
    staticParams: { kind: "correspondence" },
    fields: [
      { key: "row", label: "Variable en ligne", kind: "variable" },
      { key: "column", label: "Variable en colonne", kind: "variable" },
    ] },

  { id: "dim_mds", group: "Échelle", title: "Positionnement multidimensionnel (MDS)", engine: "dimension",
    staticParams: { kind: "mds" },
    fields: [{ key: "variables", label: "Variables", kind: "variables", filter: isNumeric }] },

  { id: "np_mcnemar", group: "Tests non paramétriques", title: "McNemar (2 appariés binaires)", engine: "nonparametric",
    staticParams: { kind: "mcnemar" },
    fields: [
      { key: "variable1", label: "Variable 1", kind: "variable" },
      { key: "variable2", label: "Variable 2", kind: "variable" },
    ] },
  { id: "np_cochran", group: "Tests non paramétriques", title: "Cochran Q (k appariés binaires)", engine: "nonparametric",
    staticParams: { kind: "cochran" }, fields: [{ key: "within", label: "Variables", kind: "variables" }] },
  { id: "np_sign", group: "Tests non paramétriques", title: "Test des signes (2 appariés)", engine: "nonparametric",
    staticParams: { kind: "sign" },
    fields: [
      { key: "variable1", label: "Variable 1", kind: "variable", filter: isNumeric },
      { key: "variable2", label: "Variable 2", kind: "variable", filter: isNumeric },
    ] },

  { id: "fc_autocorr", group: "Prévisions", title: "Autocorrélations (ACF/PACF)", engine: "forecast",
    staticParams: { kind: "autocorr" },
    fields: [
      { key: "variable", label: "Série temporelle", kind: "variable", filter: isNumeric },
      { key: "lags", label: "Décalages", kind: "number", default: 16 },
    ] },
  { id: "fc_exp", group: "Prévisions", title: "Lissage exponentiel", engine: "forecast",
    staticParams: { kind: "expsmoothing" },
    fields: [
      { key: "variable", label: "Série temporelle", kind: "variable", filter: isNumeric },
      { key: "forecast", label: "Périodes à prévoir", kind: "number", default: 5 },
    ] },
  { id: "fc_arima", group: "Prévisions", title: "ARIMA", engine: "forecast",
    staticParams: { kind: "arima" },
    fields: [
      { key: "variable", label: "Série temporelle", kind: "variable", filter: isNumeric },
      { key: "p", label: "p (AR)", kind: "number", default: 1 },
      { key: "d", label: "d (différenciation)", kind: "number", default: 0 },
      { key: "q", label: "q (MA)", kind: "number", default: 0 },
      { key: "forecast", label: "Périodes à prévoir", kind: "number", default: 5 },
    ] },

  { id: "surv_km", group: "Survie", title: "Kaplan-Meier", engine: "survival",
    staticParams: { kind: "km" },
    fields: [
      { key: "time", label: "Temps", kind: "variable", filter: isNumeric },
      { key: "event", label: "Variable d'événement", kind: "variable", filter: isNumeric },
      { key: "event_value", label: "Valeur codant l'événement", kind: "number", default: 1 },
    ] },
  { id: "surv_cox", group: "Survie", title: "Régression de Cox", engine: "survival",
    staticParams: { kind: "cox" },
    fields: [
      { key: "time", label: "Temps", kind: "variable", filter: isNumeric },
      { key: "event", label: "Variable d'événement", kind: "variable", filter: isNumeric },
      { key: "event_value", label: "Valeur codant l'événement", kind: "number", default: 1 },
      { key: "predictors", label: "Prédicteurs", kind: "variables", filter: isNumeric },
    ] },

  { id: "multiple_response", group: "Réponses multiples", title: "Fréquences (réponses multiples)", engine: "reports",
    staticParams: { kind: "multiple_response" },
    fields: [
      { key: "variables", label: "Variables dichotomiques", kind: "variables" },
      { key: "counted_value", label: "Valeur comptée", kind: "number", default: 1 },
    ] },

  { id: "roc", group: "Courbe ROC", title: "Courbe ROC", engine: "roc",
    fields: [
      { key: "actual", label: "Variable d'état", kind: "variable", filter: isNumeric },
      { key: "predictor", label: "Variable de test", kind: "variable", filter: isNumeric },
      { key: "positive_value", label: "Valeur positive (optionnel)", kind: "number", optional: true },
    ] },

  { id: "qc_control", group: "Contrôle de qualité", title: "Carte de contrôle", engine: "qc",
    fields: [{ key: "variable", label: "Variable mesurée", kind: "variable", filter: isNumeric }] },

  { id: "graph_hist", group: GRAPH_GROUP, title: "Histogramme", engine: "graphs", staticParams: { kind: "histogram" },
    fields: [{ key: "variables", label: "Variables", kind: "variables", filter: isNumeric }] },
  { id: "graph_bar", group: GRAPH_GROUP, title: "Diagramme en barres", engine: "graphs", staticParams: { kind: "bar" },
    fields: [{ key: "variables", label: "Variables", kind: "variables" }] },
  { id: "graph_box", group: GRAPH_GROUP, title: "Boîte à moustaches", engine: "graphs", staticParams: { kind: "boxplot" },
    fields: [
      { key: "variables", label: "Variables", kind: "variables", filter: isNumeric },
      { key: "group", label: "Facteur (optionnel)", kind: "variable", optional: true },
    ] },
  { id: "graph_scatter", group: GRAPH_GROUP, title: "Nuage de points", engine: "graphs", staticParams: { kind: "scatter" },
    fields: [
      { key: "x", label: "Axe X", kind: "variable", filter: isNumeric },
      { key: "y", label: "Axe Y", kind: "variable", filter: isNumeric },
    ] },
  { id: "graph_qq", group: GRAPH_GROUP, title: "Tracé Q-Q (normalité)", engine: "graphs", staticParams: { kind: "qqplot" },
    fields: [{ key: "variables", label: "Variables", kind: "variables", filter: isNumeric }] },
  { id: "graph_pp", group: GRAPH_GROUP, title: "Tracé P-P (normalité)", engine: "graphs", staticParams: { kind: "ppplot" },
    fields: [{ key: "variables", label: "Variables", kind: "variables", filter: isNumeric }] },
];

export const ANALYSIS_GROUPS = Array.from(new Set(ANALYSES.filter((a) => a.group !== GRAPH_GROUP).map((a) => a.group)));

export function analysisById(id: string): AnalysisDef | undefined {
  return ANALYSES.find((a) => a.id === id);
}

export function analysesInGroup(group: string): AnalysisDef[] {
  return ANALYSES.filter((a) => a.group === group);
}
