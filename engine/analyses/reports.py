from typing import Any
import pandas as pd

from dataset import Dataset
from analyses.util import r


def _summaries(dataset, params):
    df = dataset.to_frame()
    variables = params["variables"]
    limit = int(params.get("limit", 50))
    sub = df[variables].head(limit)
    rows = [[i + 1] + [None if pd.isna(v) else v for v in sub.iloc[i].tolist()] for i in range(sub.shape[0])]
    return {"title": "Récapitulatif des observations", "tables": [{
        "title": f"Liste des observations (max {limit})",
        "columns": ["N°"] + variables,
        "rows": rows,
    }]}


def _multiple_response(dataset, params):
    df = dataset.to_frame()
    variables = params["variables"]
    counted = pd.to_numeric(params.get("counted_value", 1), errors="coerce")
    total_cases = df.shape[0]
    rows = []
    responses = 0
    for v in variables:
        col = pd.to_numeric(df[v], errors="coerce")
        c = int((col == counted).sum())
        responses += c
        rows.append([v, c, r(100 * c / total_cases, 1)])
    for row in rows:
        row.append(r(100 * row[1] / responses, 1) if responses else 0)
    return {"title": "Réponses multiples", "tables": [{
        "title": f"Fréquences des réponses multiples (valeur comptée = {counted})",
        "columns": ["Variable", "Effectif", "% des observations", "% des réponses"],
        "rows": [[row[0], row[1], row[2], row[3]] for row in rows],
        "footnotes": [f"{total_cases} observations, {responses} réponses au total."],
    }]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "summaries")
    if kind == "multiple_response":
        return _multiple_response(dataset, params)
    return _summaries(dataset, params)
