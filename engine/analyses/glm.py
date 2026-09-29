from typing import Any
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

from dataset import Dataset
from analyses.util import r, sig

FAMILIES = {
    "gaussian": sm.families.Gaussian(),
    "poisson": sm.families.Poisson(),
    "gamma": sm.families.Gamma(),
    "binomial": sm.families.Binomial(),
}


def _generalized(dataset, params):
    df = dataset.to_frame()
    dv = params["dependent"]
    predictors = params["predictors"]
    family = params.get("family", "gaussian")
    work = df[[dv] + predictors].apply(pd.to_numeric, errors="coerce").dropna()
    X = sm.add_constant(work[predictors])
    model = sm.GLM(work[dv], X, family=FAMILIES.get(family, sm.families.Gaussian())).fit()
    rows = []
    for name in X.columns:
        display = "Constante" if name == "const" else name
        rows.append([display, r(model.params[name]), r(model.bse[name]), r(model.tvalues[name]), sig(model.pvalues[name])])
    return {"title": "Modèle linéaire généralisé", "tables": [{
        "title": f"Coefficients (famille : {family})",
        "columns": ["Terme", "B", "Erreur std", "z", "p"],
        "rows": rows,
        "footnotes": [f"Variable dépendante : {dv}. AIC = {r(model.aic, 1)}, déviance = {r(model.deviance, 1)}."],
    }]}


def _mixed(dataset, params):
    df = dataset.to_frame()
    dv = params["dependent"]
    fixed = params["fixed"]
    group = params["group"]
    cols = [dv] + fixed + [group]
    work = df[cols].copy()
    for c in [dv] + fixed:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna()
    formula = f"{dv} ~ " + " + ".join(fixed)
    model = smf.mixedlm(formula, work, groups=work[group]).fit()
    rows = []
    for name in model.params.index:
        if name == "Group Var":
            continue
        rows.append([str(name), r(model.params[name]), r(model.bse[name]), sig(model.pvalues[name])])
    return {"title": "Modèle linéaire mixte", "tables": [{
        "title": "Effets fixes",
        "columns": ["Terme", "Estimation", "Erreur std", "p"],
        "rows": rows,
        "footnotes": [f"Variable dépendante : {dv}. Groupe aléatoire : {group}.",
                      f"Variance du groupe = {r(model.cov_re.iloc[0, 0])}."],
    }]}


def _manova(dataset, params):
    df = dataset.to_frame()
    dependents = params["dependents"]
    factor = params["factor"]
    work = df[dependents + [factor]].copy()
    for c in dependents:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna()
    work = work.rename(columns={factor: "FACTOR"})
    work["FACTOR"] = work["FACTOR"].astype("category")
    formula = " + ".join(dependents) + " ~ C(FACTOR)"
    mv = sm.multivariate.MANOVA.from_formula(formula, data=work)
    test = mv.mv_test()
    res = test.results["C(FACTOR)"]["stat"]
    rows = []
    for name in res.index:
        rows.append([str(name), r(res.loc[name, "Value"]), r(res.loc[name, "F Value"]),
                     r(res.loc[name, "Num DF"], 1), r(res.loc[name, "Den DF"], 1), sig(res.loc[name, "Pr > F"])])
    return {"title": "MANOVA", "tables": [{
        "title": f"Tests multivariés (effet de {factor})",
        "columns": ["Test", "Valeur", "F", "ddl num.", "ddl dén.", "p"],
        "rows": rows,
        "footnotes": [f"Variables dépendantes : {', '.join(dependents)}."],
    }]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "generalized")
    if kind == "mixed":
        return _mixed(dataset, params)
    if kind == "manova":
        return _manova(dataset, params)
    return _generalized(dataset, params)
