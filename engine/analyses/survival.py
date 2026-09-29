from typing import Any
import numpy as np
import pandas as pd

from dataset import Dataset
from analyses.util import r, sig
from charts import new_axes, figure_to_png, BLUE


def _kaplan(dataset, params):
    from statsmodels.duration.survfunc import SurvfuncRight

    df = dataset.to_frame()
    time = pd.to_numeric(df[params["time"]], errors="coerce")
    event = pd.to_numeric(df[params["event"]], errors="coerce")
    ev_val = float(params.get("event_value", 1))
    mask = time.notna() & event.notna()
    status = (event[mask] == ev_val).astype(int)
    sf = SurvfuncRight(time[mask], status)
    fig, ax = new_axes()
    ax.step(sf.surv_times, sf.surv_prob, where="post", color=BLUE)
    ax.set_xlabel("Temps")
    ax.set_ylabel("Probabilité de survie")
    ax.set_title("Courbe de survie de Kaplan-Meier")
    ax.set_ylim(0, 1.02)
    rows = [[r(t, 2), r(p, 3)] for t, p in list(zip(sf.surv_times, sf.surv_prob))[:: max(1, len(sf.surv_times) // 15)]]
    return {"title": "Kaplan-Meier", "tables": [
        {"title": "Fonction de survie (échantillon)", "columns": ["Temps", "Survie"], "rows": rows,
         "footnotes": [f"N = {int(mask.sum())}, événements = {int(status.sum())} (valeur événement = {ev_val})."]},
    ], "images": [{"title": "Courbe de survie", "src": figure_to_png(fig)}]}


def _cox(dataset, params):
    from statsmodels.duration.hazard_regression import PHReg

    df = dataset.to_frame()
    predictors = params["predictors"]
    cols = [params["time"], params["event"]] + predictors
    work = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    ev_val = float(params.get("event_value", 1))
    status = (work[params["event"]] == ev_val).astype(int)
    model = PHReg(work[params["time"]], work[predictors], status=status).fit()
    rows = []
    params_arr = np.asarray(model.params)
    bse = np.asarray(model.bse)
    pvals = np.asarray(model.pvalues)
    for i, name in enumerate(predictors):
        rows.append([name, r(params_arr[i]), r(bse[i]), sig(pvals[i]), r(float(np.exp(params_arr[i])))])
    return {"title": "Régression de Cox", "tables": [{
        "title": "Coefficients (risques proportionnels de Cox)",
        "columns": ["Prédicteur", "B", "Erreur std", "p", "Hazard ratio (exp B)"],
        "rows": rows,
        "footnotes": [f"N = {work.shape[0]}, événements = {int(status.sum())} (valeur événement = {ev_val})."],
    }]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "km")
    if kind == "cox":
        return _cox(dataset, params)
    return _kaplan(dataset, params)
