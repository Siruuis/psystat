from typing import Any
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

from dataset import Dataset
from analyses.util import r, sig


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    factors = params["factors"]
    if len(factors) < 2:
        return {"title": "Analyse log-linéaire", "error": "Sélectionnez au moins 2 facteurs."}

    work = df[factors].dropna().copy()
    for f in factors:
        work[f] = work[f].astype("category")

    counts = work.groupby(factors, observed=True).size().reset_index(name="count")
    terms = " + ".join(f"C({f})" for f in factors)
    interaction = " + " + ":".join(f"C({f})" for f in factors) if params.get("saturated", True) else ""
    formula = f"count ~ {terms}{interaction}"

    model = smf.glm(formula=formula, data=counts, family=sm.families.Poisson()).fit()
    indep = smf.glm(formula=f"count ~ {terms}", data=counts, family=sm.families.Poisson()).fit()

    param_rows = []
    for name in model.params.index:
        param_rows.append([str(name), r(model.params[name]), r(model.bse[name]), sig(model.pvalues[name])])

    fit_table = {
        "title": "Qualité d'ajustement du modèle d'indépendance",
        "columns": ["Rapport de vraisemblance (déviance)", "ddl", "p", "Pearson χ²"],
        "rows": [[r(indep.deviance), int(indep.df_resid), sig(1 - _chi2cdf(indep.deviance, indep.df_resid)),
                  r(indep.pearson_chi2)]],
        "footnotes": ["Un p < .05 indique une association entre les facteurs (le modèle d'indépendance est rejeté)."],
    }
    param_table = {
        "title": "Estimations des paramètres (modèle saturé, Poisson log-linéaire)",
        "columns": ["Terme", "Lambda (B)", "Erreur std", "p"],
        "rows": param_rows,
    }
    return {"title": "Analyse log-linéaire", "tables": [fit_table, param_table]}


def _chi2cdf(x, dfree):
    from scipy import stats
    return float(stats.chi2.cdf(x, dfree))
