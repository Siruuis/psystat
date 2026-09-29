from typing import Any
import pandas as pd

from dataset import Dataset
from analyses.util import r


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    variables = params.get("variables") or dataset.columns
    tables = []

    for name in variables:
        series = df[name]
        labels = dataset.value_labels(name)
        valid = series.dropna()
        total = len(series)
        counts = valid.value_counts(dropna=True).sort_index()
        cum = 0
        rows = []
        for value, count in counts.items():
            pct = 100 * count / total if total else 0
            valid_pct = 100 * count / len(valid) if len(valid) else 0
            cum += valid_pct
            display = labels.get(str(value), str(value))
            rows.append([display, int(count), r(pct, 1), r(valid_pct, 1), r(cum, 1)])
        missing = total - len(valid)
        rows.append(["Manquant", int(missing), r(100 * missing / total, 1) if total else 0, "", ""])
        rows.append(["Total", int(total), 100.0, "", ""])

        tables.append({
            "title": f"Effectifs — {name}",
            "columns": ["Valeur", "Effectif", "Pourcentage", "% valide", "% cumulé"],
            "rows": rows,
        })

    return {"title": "Effectifs", "tables": tables}
