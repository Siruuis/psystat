from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from dataset import Dataset
from analyses.util import r


STATS = [
    ("mean", "Moyenne", lambda s: s.mean()),
    ("sem", "Erreur std", lambda s: s.std(ddof=1) / np.sqrt(len(s))),
    ("median", "Médiane", lambda s: s.median()),
    ("sd", "Écart-type", lambda s: s.std(ddof=1)),
    ("variance", "Variance", lambda s: s.var(ddof=1)),
    ("min", "Minimum", lambda s: s.min()),
    ("max", "Maximum", lambda s: s.max()),
    ("range", "Étendue", lambda s: s.max() - s.min()),
    ("skew", "Asymétrie", lambda s: stats.skew(s, bias=False) if len(s) > 2 else np.nan),
    ("kurt", "Aplatissement", lambda s: stats.kurtosis(s, fisher=True, bias=False) if len(s) > 3 else np.nan),
]

DEFAULT_ON = {"mean", "sem", "median", "sd", "variance", "min", "max", "range", "skew", "kurt"}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    variables = params.get("variables") or dataset.columns
    normality = params.get("normality", True)

    has_flags = any(f"stat_{key}" in params for key, _, _ in STATS)
    active = [(key, label, fn) for key, label, fn in STATS
              if (params.get(f"stat_{key}") if has_flags else key in DEFAULT_ON)]

    columns = ["Variable", "N", "Manquants"] + [label for _, label, _ in active]
    stat_rows = []
    normality_rows = []

    for name in variables:
        series = pd.to_numeric(df[name], errors="coerce").dropna()
        n = int(series.shape[0])
        n_missing = int(df[name].shape[0] - n)
        if n == 0:
            stat_rows.append([name, 0, n_missing] + [None] * len(active))
            continue
        stat_rows.append([name, n, n_missing] + [r(fn(series)) for _, _, fn in active])
        if normality and n >= 3:
            w, p = stats.shapiro(series)
            try:
                from statsmodels.stats.diagnostic import lilliefors
                ks_d, ks_p = lilliefors(series, dist="norm")
            except Exception:
                ks_d, ks_p = stats.kstest(series, "norm", args=(series.mean(), series.std(ddof=1)))
            normality_rows.append([name, n, r(ks_d), r(ks_p, 3), r(w), r(p, 3), "oui" if p > 0.05 else "non"])

    tables = [{"title": "Statistiques descriptives", "columns": columns, "rows": stat_rows}]
    if normality_rows:
        tables.append({
            "title": "Tests de normalité",
            "columns": ["Variable", "N", "K-S (Lilliefors) D", "p", "Shapiro-Wilk W", "p ", "Normalité (S-W p > .05)"],
            "rows": normality_rows,
            "footnotes": ["Un p > .05 suggère une distribution compatible avec la normalité. Kolmogorov-Smirnov avec correction de Lilliefors."],
        })

    return {"title": "Statistiques descriptives", "tables": tables}
