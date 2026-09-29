from typing import Any
import pandas as pd
import pingouin as pg

from dataset import Dataset
from analyses.util import r


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    x = params["x"]
    y = params["y"]
    covar = params["covariates"]
    data = df[[x, y] + covar].apply(pd.to_numeric, errors="coerce")
    res = pg.partial_corr(data=data, x=x, y=y, covar=covar)
    row = res.iloc[0]
    ci = row["CI95%"]
    return {
        "title": "Corrélation partielle",
        "tables": [{
            "title": f"Corrélation partielle {x} — {y}",
            "columns": ["N", "r partiel", "IC 95%", "p"],
            "rows": [[int(row["n"]), r(row["r"]), f"[{r(ci[0])} ; {r(ci[1])}]", r(row["p-val"])]],
            "footnotes": [f"Contrôle de : {', '.join(covar)}."],
        }],
    }
