from typing import Any
import numpy as np
import pandas as pd

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png, BLUE


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    var = params["variable"]
    s = pd.to_numeric(df[var], errors="coerce").dropna().reset_index(drop=True)
    mean = s.mean()
    mr = s.diff().abs().dropna()
    sigma = mr.mean() / 1.128 if len(mr) else s.std(ddof=1)
    sd = s.std(ddof=1)
    ucl = mean + 3 * sigma
    lcl = mean - 3 * sigma
    out = int(((s > ucl) | (s < lcl)).sum())

    fig, ax = new_axes(6, 3.4)
    ax.plot(range(len(s)), s, "o-", color=BLUE, markersize=4)
    ax.axhline(mean, color="#2ca02c", lw=1.3, label="Moyenne")
    ax.axhline(ucl, color="#e4572e", ls="--", lw=1.2, label="LCS (+3σ)")
    ax.axhline(lcl, color="#e4572e", ls="--", lw=1.2, label="LCI (-3σ)")
    ax.set_title(f"Carte de contrôle des individus — {var}")
    ax.legend(fontsize=8)

    return {"title": "Carte de contrôle", "tables": [{
        "title": "Limites de contrôle",
        "columns": ["Moyenne", "Écart-type", "LCS (+3σ)", "LCI (-3σ)", "Points hors limites"],
        "rows": [[r(mean), r(sd), r(ucl), r(lcl), out]],
    }], "images": [{"title": "Carte de contrôle", "src": figure_to_png(fig)}]}
