from typing import Any
import pandas as pd

from dataset import Dataset
from analyses.util import r


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    dependents = params["dependents"]
    factor = params["factor"]
    labels = dataset.value_labels(factor)
    tables = []

    for dv in dependents:
        work = df[[dv, factor]].copy()
        work[dv] = pd.to_numeric(work[dv], errors="coerce")
        rows = []
        for lvl, sub in work.groupby(factor):
            s = sub[dv].dropna()
            rows.append([labels.get(str(lvl), str(lvl)), int(s.shape[0]), r(s.mean()), r(s.std(ddof=1)),
                         r(s.median()), r(s.min()), r(s.max())])
        total = work[dv].dropna()
        rows.append(["Total", int(total.shape[0]), r(total.mean()), r(total.std(ddof=1)),
                     r(total.median()), r(total.min()), r(total.max())])
        tables.append({
            "title": f"Rapport de moyennes — {dv} selon {factor}",
            "columns": ["Groupe", "N", "Moyenne", "Écart-type", "Médiane", "Minimum", "Maximum"],
            "rows": rows,
        })

    return {"title": "Moyennes", "tables": tables}
