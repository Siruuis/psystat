from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png, BLUE


def _describe(series: pd.Series):
    s = series.dropna()
    n = len(s)
    if n == 0:
        return None
    mean = s.mean()
    sd = s.std(ddof=1)
    sem = sd / np.sqrt(n)
    tcrit = stats.t.ppf(0.975, n - 1) if n > 1 else float("nan")
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    return [
        n, r(mean), r(sem), r(mean - tcrit * sem), r(mean + tcrit * sem), r(s.median()),
        r(sd), r(s.var(ddof=1)), r(s.min()), r(s.max()), r(s.max() - s.min()), r(q3 - q1),
        r(stats.skew(s, bias=False)) if n > 2 else None, r(stats.kurtosis(s, fisher=True, bias=False)) if n > 3 else None,
    ]


DESC_COLS = ["N", "Moyenne", "Erreur std", "IC- 95%", "IC+ 95%", "Médiane", "Écart-type",
             "Variance", "Minimum", "Maximum", "Étendue", "Écart interquartile", "Asymétrie", "Aplatissement"]


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    variables = params["variables"]
    factor = params.get("factor")
    tables = []
    images = []

    for v in variables:
        desc_rows = []
        norm_rows = []
        if factor:
            labels = dataset.value_labels(factor)
            for lvl, sub in df.groupby(factor):
                name = labels.get(str(lvl), str(lvl))
                d = _describe(pd.to_numeric(sub[v], errors="coerce"))
                if d:
                    desc_rows.append([name] + d)
                s = pd.to_numeric(sub[v], errors="coerce").dropna()
                if len(s) >= 3:
                    w, p = stats.shapiro(s)
                    norm_rows.append([name, len(s), r(w), r(p), "oui" if p > 0.05 else "non"])
            head = [factor] + DESC_COLS
        else:
            d = _describe(pd.to_numeric(df[v], errors="coerce"))
            if d:
                desc_rows.append([v] + d)
            s = pd.to_numeric(df[v], errors="coerce").dropna()
            if len(s) >= 3:
                w, p = stats.shapiro(s)
                norm_rows.append([v, len(s), r(w), r(p), "oui" if p > 0.05 else "non"])
            head = ["Variable"] + DESC_COLS

        tables.append({"title": f"Descriptives — {v}", "columns": head, "rows": desc_rows})
        tables.append({
            "title": f"Tests de normalité — {v}",
            "columns": ["Groupe", "N", "Shapiro-Wilk W", "p", "Normalité (p > .05)"],
            "rows": norm_rows,
        })

        if factor:
            groups = [pd.to_numeric(sub[v], errors="coerce").dropna().values for _, sub in df.groupby(factor)]
            groups = [g for g in groups if len(g) > 1]
            if len(groups) >= 2:
                lw, lp = stats.levene(*groups, center="mean")
                tables.append({
                    "title": f"Homogénéité des variances (Levene) — {v}",
                    "columns": ["Statistique de Levene", "p", "Variances égales (p > .05)"],
                    "rows": [[r(lw), r(lp), "oui" if lp > 0.05 else "non"]],
                })

        fig, ax = new_axes()
        if factor:
            labels = dataset.value_labels(factor)
            groups, names = [], []
            for lvl, sub in df.groupby(factor):
                groups.append(pd.to_numeric(sub[v], errors="coerce").dropna())
                names.append(labels.get(str(lvl), str(lvl)))
            ax.boxplot(groups, labels=names, patch_artist=True,
                       boxprops=dict(facecolor="#dbe6fb", color=BLUE), medianprops=dict(color="#e4572e"))
        else:
            ax.boxplot(pd.to_numeric(df[v], errors="coerce").dropna(), patch_artist=True,
                       boxprops=dict(facecolor="#dbe6fb", color=BLUE), medianprops=dict(color="#e4572e"))
        ax.set_title(f"Boîte à moustaches — {v}")
        images.append({"title": f"Boîte à moustaches — {v}", "src": figure_to_png(fig)})

    return {"title": "Explorer", "tables": tables, "images": images}
