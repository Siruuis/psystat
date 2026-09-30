from typing import Any
import numpy as np
import pandas as pd
import pingouin as pg
import statsmodels.api as sm

from dataset import Dataset
from analyses.util import r, sig
from charts import new_axes, figure_to_png, BLUE


def _linear(df, dv, predictors, work):
    from scipy import stats as _st

    X = work[predictors]
    y = work[dv]
    n, k = work.shape[0], len(predictors)
    res = pg.linear_regression(X, y, as_dataframe=True)

    coefs = dict(zip(res["names"], res["coef"]))
    intercept = coefs.get("Intercept", 0.0)
    pred = intercept + sum(coefs[p_] * X[p_] for p_ in predictors)
    resid = y - pred
    ss_res = float((resid ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    ss_reg = ss_tot - ss_res
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    adj = 1 - (1 - r2) * (n - 1) / (n - k - 1) if n - k - 1 > 0 else r2
    df_reg, df_res = k, n - k - 1
    ms_reg = ss_reg / df_reg if df_reg else float("nan")
    ms_res = ss_res / df_res if df_res else float("nan")
    F = ms_reg / ms_res if ms_res else float("nan")
    pF = _st.f.sf(F, df_reg, df_res) if df_res > 0 else float("nan")
    se_est = ms_res ** 0.5

    sy = y.std(ddof=1)
    beta = {p_: coefs[p_] * X[p_].std(ddof=1) / sy if sy else 0 for p_ in predictors}

    model_table = {
        "title": "Récapitulatif du modèle",
        "columns": ["R", "R²", "R² ajusté", "Erreur std de l'estimation", "N"],
        "rows": [[r(r2 ** 0.5), r(r2), r(adj), r(se_est), n]],
    }
    anova_table = {
        "title": "ANOVA du modèle",
        "columns": ["Source", "Somme des carrés", "ddl", "Carré moyen", "F", "p"],
        "rows": [
            ["Régression", r(ss_reg), df_reg, r(ms_reg), r(F), sig(pF)],
            ["Résidu", r(ss_res), df_res, r(ms_res), "", ""],
            ["Total", r(ss_tot), n - 1, "", "", ""],
        ],
    }
    coef_table = {
        "title": "Coefficients",
        "columns": ["Prédicteur", "B", "Erreur std", "Bêta", "t", "p", "IC 2.5%", "IC 97.5%"],
        "rows": [[row["names"], r(row["coef"]), r(row["se"]),
                  r(beta.get(row["names"])) if row["names"] in beta else "",
                  r(row["T"]), sig(row["pval"]), r(row["CI[2.5%]"]), r(row["CI[97.5%]"])] for _, row in res.iterrows()],
        "footnotes": [f"Variable dépendante : {dv}. Bêta = coefficients standardisés."],
    }
    return {"title": "Régression linéaire", "tables": [model_table, anova_table, coef_table]}


def _logistic(df, dv, predictors, work):
    cats = sorted(pd.unique(work[dv]))
    if len(cats) != 2:
        return {"title": "Régression logistique", "error": "La variable dépendante doit être binaire (2 modalités)."}
    y = (work[dv] == cats[1]).astype(int)
    X = work[predictors]
    Xc = sm.add_constant(X)
    model = sm.Logit(y, Xc).fit(disp=0)
    ci = model.conf_int()
    n = work.shape[0]

    rows = []
    for name in Xc.columns:
        display = "Constante" if name == "const" else name
        wald = model.tvalues[name] ** 2
        rows.append([display, r(model.params[name]), r(model.bse[name]), r(wald),
                     sig(model.pvalues[name]), r(float(np.exp(model.params[name]))),
                     f"[{r(float(np.exp(ci.loc[name, 0])))} ; {r(float(np.exp(ci.loc[name, 1])))}]"])
    coef_table = {
        "title": "Variables dans l'équation",
        "columns": ["Prédicteur", "B", "Erreur std", "Wald (z²)", "p", "Exp(B) / OR", "IC 95% (OR)"],
        "rows": rows,
        "footnotes": [f"Variable dépendante : {dv} (référence = {cats[0]}, événement = {cats[1]}). N = {n}."],
    }

    cs = 1 - np.exp(-(2 / n) * (model.llf - model.llnull))
    nagel = cs / (1 - np.exp(2 * model.llnull / n))
    fit_table = {
        "title": "Récapitulatif du modèle",
        "columns": ["-2 log-vraisemblance", "R² Cox & Snell", "R² Nagelkerke", "R² McFadden"],
        "rows": [[r(-2 * model.llf, 2), r(cs), r(nagel), r(model.prsquared)]],
    }

    pred = (model.predict(Xc) >= 0.5).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    acc = 100 * (tp + tn) / n if n else 0
    class_table = {
        "title": "Tableau de classification (seuil 0,5)",
        "columns": ["Observé \\ Prédit", str(cats[0]), str(cats[1]), "% correct"],
        "rows": [
            [str(cats[0]), tn, fp, r(100 * tn / (tn + fp), 1) if (tn + fp) else 0],
            [str(cats[1]), fn, tp, r(100 * tp / (tp + fn), 1) if (tp + fn) else 0],
            ["% global", "", "", r(acc, 1)],
        ],
    }
    return {"title": "Régression logistique", "tables": [fit_table, class_table, coef_table]}


def _multinomial(df, dv, predictors, work):
    X = sm.add_constant(work[predictors])
    cats_sorted = sorted(pd.unique(work[dv]))
    ref = cats_sorted[-1]
    order = [ref] + [c for c in cats_sorted if c != ref]
    codes = {c: i for i, c in enumerate(order)}
    y = work[dv].map(codes)
    model = sm.MNLogit(y, X).fit(disp=0)
    params = model.params
    pvals = model.pvalues
    noncats = order[1:]

    def _fmt(c):
        return str(int(c)) if isinstance(c, float) and c.is_integer() else str(c)

    rows = []
    for j, cat in enumerate(noncats):
        for name in X.columns:
            display = "Constante" if name == "const" else name
            rows.append([_fmt(cat), display, r(params.iloc[:, j][name]), sig(pvals.iloc[:, j][name]),
                         r(float(np.exp(params.iloc[:, j][name])))])
    return {"title": "Régression multinomiale", "tables": [{
        "title": f"Coefficients (catégorie de référence = {_fmt(ref)})",
        "columns": ["Modalité", "Prédicteur", "B", "p", "Odds ratio"],
        "rows": rows,
        "footnotes": [f"Variable dépendante : {dv}. Pseudo R² (McFadden) = {r(model.prsquared)}."],
    }]}


def _ordinal(df, dv, predictors, work):
    from statsmodels.miscmodels.ordinal_model import OrderedModel

    model = OrderedModel(work[dv], work[predictors], distr="logit").fit(method="bfgs", disp=0)
    rows = []
    for name in model.params.index:
        rows.append([str(name), r(model.params[name]), r(model.bse[name]), sig(model.pvalues[name])])
    return {"title": "Régression ordinale", "tables": [{
        "title": "Estimations des paramètres (logit ordinal)",
        "columns": ["Paramètre", "Estimation", "Erreur std", "p"],
        "rows": rows,
        "footnotes": [f"Variable dépendante ordinale : {dv}."],
    }]}


def _poisson(df, dv, predictors, work):
    X = sm.add_constant(work[predictors])
    model = sm.GLM(work[dv], X, family=sm.families.Poisson()).fit()
    rows = []
    for name in X.columns:
        display = "Constante" if name == "const" else name
        rows.append([display, r(model.params[name]), r(model.bse[name]), sig(model.pvalues[name]),
                     r(float(np.exp(model.params[name])))])
    disp = model.pearson_chi2 / model.df_resid if model.df_resid else float("nan")
    disp_note = "  ⚠ surdispersion (envisagez binomiale négative)" if disp and disp > 1.5 else ""
    return {"title": "Régression de Poisson", "tables": [{
        "title": "Coefficients (régression de Poisson)",
        "columns": ["Prédicteur", "B", "Erreur std", "p", "Ratio de taux (exp B)"],
        "rows": rows,
        "footnotes": [f"Variable dépendante (comptage) : {dv}. AIC = {r(model.aic, 1)}.",
                      f"Dispersion (Pearson χ²/ddl) = {r(disp)}.{disp_note}"],
    }]}


def _curve(df, dv, predictors, work):
    x = work[predictors[0]].values
    y = work[dv].values
    order = np.argsort(x)
    models = {"Linéaire": 1, "Quadratique": 2, "Cubique": 3}
    rows = []
    fig, ax = new_axes()
    ax.scatter(x, y, color=BLUE, alpha=0.6, edgecolor="white")
    colors = ["#e4572e", "#17a2b8", "#8e44ad"]
    for (name, deg), col in zip(models.items(), colors):
        coef = np.polyfit(x, y, deg)
        pred = np.polyval(coef, x)
        ss_res = np.sum((y - pred) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        r2 = 1 - ss_res / ss_tot if ss_tot else 0
        rows.append([name, deg, r(r2)])
        ax.plot(x[order], np.polyval(coef, x[order]), color=col, lw=1.5, label=f"{name} (R²={round(r2,3)})")
    ax.legend(fontsize=8)
    ax.set_xlabel(predictors[0])
    ax.set_ylabel(dv)
    ax.set_title("Estimation de courbe")
    return {"title": "Estimation de courbe", "tables": [{
        "title": "Récapitulatif des modèles",
        "columns": ["Modèle", "Degré", "R²"], "rows": rows,
    }], "images": [{"title": "Ajustements", "src": figure_to_png(fig)}]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    df = df.loc[:, ~df.columns.duplicated()]
    kind = params.get("kind", "linear")
    dv = params["dependent"]
    predictors = [p for p in params["predictors"] if p != dv]
    if not predictors:
        return {"error": "Sélectionnez au moins un prédicteur différent de la variable dépendante."}
    cols = list(dict.fromkeys([dv] + predictors))
    work = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    if work.shape[0] < len(predictors) + 2:
        return {"error": "Pas assez d'observations valides pour estimer la régression (trop de valeurs manquantes ?)."}

    if kind == "logistic":
        return _logistic(df, dv, predictors, work)
    if kind == "multinomial":
        return _multinomial(df, dv, predictors, work)
    if kind == "ordinal":
        return _ordinal(df, dv, predictors, work)
    if kind == "poisson":
        return _poisson(df, dv, predictors, work)
    if kind == "curve":
        return _curve(df, dv, predictors, work)
    return _linear(df, dv, predictors, work)
