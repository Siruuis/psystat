from typing import Any
import numpy as np
import pandas as pd

from dataset import Dataset
from analyses.util import r, sig
from charts import new_axes, figure_to_png, BLUE


def _series(df, var):
    return pd.to_numeric(df[var], errors="coerce").dropna().reset_index(drop=True)


def _autocorr(dataset, params):
    from statsmodels.tsa.stattools import acf, pacf

    df = dataset.to_frame()
    s = _series(df, params["variable"])
    lags = min(int(params.get("lags", 16)), len(s) // 2)
    a = acf(s, nlags=lags)
    p = pacf(s, nlags=lags)
    fig, axes = new_axes(6, 4)
    import matplotlib.pyplot as plt
    plt.close(fig)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(6, 4))
    ax1.bar(range(len(a)), a, color=BLUE)
    ax1.set_title("Fonction d'autocorrélation (ACF)")
    ax2.bar(range(len(p)), p, color="#e4572e")
    ax2.set_title("Autocorrélation partielle (PACF)")
    rows = [[i, r(a[i]), r(p[i])] for i in range(1, len(a))]
    return {"title": "Autocorrélations", "tables": [
        {"title": "ACF / PACF par décalage", "columns": ["Décalage", "ACF", "PACF"], "rows": rows},
    ], "images": [{"title": "Corrélogrammes", "src": figure_to_png(fig)}]}


def _expsmoothing(dataset, params):
    from statsmodels.tsa.holtwinters import SimpleExpSmoothing

    df = dataset.to_frame()
    s = _series(df, params["variable"])
    steps = int(params.get("forecast", 5))
    model = SimpleExpSmoothing(s, initialization_method="estimated").fit()
    fc = model.forecast(steps)
    fig, ax = new_axes()
    ax.plot(range(len(s)), s, color=BLUE, label="Observé")
    ax.plot(range(len(s), len(s) + steps), fc, color="#e4572e", marker="o", label="Prévision")
    ax.legend(fontsize=8)
    ax.set_title("Lissage exponentiel simple")
    rows = [[len(s) + i + 1, r(v)] for i, v in enumerate(fc)]
    return {"title": "Lissage exponentiel", "tables": [
        {"title": "Prévisions", "columns": ["Période", "Valeur prévue"], "rows": rows,
         "footnotes": [f"Alpha (lissage) = {r(model.params['smoothing_level'])}, SSE = {r(model.sse, 1)}."]},
    ], "images": [{"title": "Prévision", "src": figure_to_png(fig)}]}


def _arima(dataset, params):
    from statsmodels.tsa.arima.model import ARIMA

    df = dataset.to_frame()
    s = _series(df, params["variable"])
    order = (int(params.get("p", 1)), int(params.get("d", 0)), int(params.get("q", 0)))
    steps = int(params.get("forecast", 5))
    model = ARIMA(s, order=order).fit()
    fc = model.forecast(steps)
    rows = []
    for name in model.params.index:
        rows.append([str(name), r(model.params[name]), r(model.bse[name]) if name in model.bse else None,
                     sig(model.pvalues[name]) if name in model.pvalues else ""])
    fig, ax = new_axes()
    ax.plot(range(len(s)), s, color=BLUE, label="Observé")
    ax.plot(range(len(s), len(s) + steps), fc, color="#e4572e", marker="o", label="Prévision")
    ax.legend(fontsize=8)
    ax.set_title(f"ARIMA{order}")
    return {"title": "ARIMA", "tables": [
        {"title": f"Paramètres ARIMA{order}", "columns": ["Terme", "Estimation", "Erreur std", "p"], "rows": rows,
         "footnotes": [f"AIC = {r(model.aic, 1)}."]},
        {"title": "Prévisions", "columns": ["Période", "Valeur prévue"],
         "rows": [[len(s) + i + 1, r(v)] for i, v in enumerate(fc)]},
    ], "images": [{"title": "Prévision ARIMA", "src": figure_to_png(fig)}]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "autocorr")
    if kind == "expsmoothing":
        return _expsmoothing(dataset, params)
    if kind == "arima":
        return _arima(dataset, params)
    return _autocorr(dataset, params)
