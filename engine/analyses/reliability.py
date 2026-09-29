from typing import Any
import numpy as np
import pandas as pd
import pingouin as pg

from dataset import Dataset
from analyses.util import r, numeric


def _omega(data: pd.DataFrame) -> float | None:
    try:
        from statsmodels.multivariate.factor import Factor

        clean = data.dropna()
        if clean.shape[0] < clean.shape[1] + 2:
            return None
        fa = Factor(clean.values, n_factor=1, method="pa").fit()
        load = np.abs(np.asarray(fa.loadings).ravel())
        try:
            uniq = float(np.sum(np.asarray(fa.uniqueness)))
        except Exception:
            uniq = float(np.sum(np.clip(1 - load ** 2, 0, None)))
        s = load.sum()
        return float(s ** 2 / (s ** 2 + uniq)) if (s ** 2 + uniq) else None
    except Exception:
        return None


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    items = params["items"]
    data = numeric(df, items).dropna()

    if data.shape[1] < 2:
        return {"title": "Analyse de fiabilité", "error": "Sélectionnez au moins 2 items."}

    alpha, ci = pg.cronbach_alpha(data=data)
    omega = _omega(data)

    summary_rows = [["Alpha de Cronbach", r(alpha), f"[{r(ci[0])} ; {r(ci[1])}]"]]
    if omega is not None:
        summary_rows.append(["Omega de McDonald", r(omega), ""])
    summary = {
        "title": "Statistiques de fiabilité",
        "columns": ["Indice", "Valeur", "IC 95%"],
        "rows": summary_rows,
        "footnotes": [f"Basé sur {data.shape[0]} observations complètes et {data.shape[1]} items.",
                      "Repère : alpha > .70 acceptable, > .80 bon, > .90 excellent."],
    }

    item_rows = []
    total = data.sum(axis=1)
    for item in items:
        rest = total - data[item]
        corr = data[item].corr(rest)
        remaining = [c for c in items if c != item]
        try:
            a_del, _ = pg.cronbach_alpha(data=data[remaining])
        except Exception:
            a_del = None
        item_rows.append([
            item,
            r(data[item].mean()),
            r(data[item].std(ddof=1)),
            r(corr),
            r(a_del),
        ])

    items_table = {
        "title": "Statistiques par item",
        "columns": ["Item", "Moyenne", "Écart-type", "Corrélation item-total corrigée", "Alpha si item supprimé"],
        "rows": item_rows,
    }

    return {"title": "Analyse de fiabilité", "tables": [summary, items_table]}
