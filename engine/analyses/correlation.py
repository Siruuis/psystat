from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from dataset import Dataset
from analyses.util import r
from analyses import apa


def _stars(p: float) -> str:
    if p < 0.001:
        return "***"
    if p < 0.01:
        return "**"
    if p < 0.05:
        return "*"
    return ""


METHOD_LABELS = {"pearson": "Pearson (r)", "spearman": "Spearman (rho)", "kendall": "Kendall (tau-b)"}


def _corr_fn(method):
    if method == "spearman":
        return stats.spearmanr
    if method == "kendall":
        return stats.kendalltau
    return stats.pearsonr


def _matrix(data: pd.DataFrame, variables, method, tail, flag) -> dict:
    fn = _corr_fn(method)
    rows = []
    for a in variables:
        r_cells = []
        p_cells = []
        for b in variables:
            pair = data[[a, b]].dropna()
            if a == b:
                r_cells.append("1")
                p_cells.append("")
                continue
            if pair.shape[0] < 3:
                r_cells.append("-")
                p_cells.append("-")
                continue
            coef, p = fn(pair[a], pair[b])
            if tail == "one":
                p = p / 2
            star = _stars(p) if flag else ""
            pfmt = "< .001" if p < 0.001 else f"{round(p, 3)}"
            r_cells.append(f"{round(coef, 3)}{star}")
            p_cells.append(f"{pfmt} (n={pair.shape[0]})")
        rows.append([a, "Corrélation"] + r_cells)
        rows.append(["", "Sig. " + ("(uni)" if tail == "one" else "(bi)")] + p_cells)
    foot = ["* p < .05   ** p < .01   *** p < .001"] if flag else []
    return {"title": f"Corrélations — {METHOD_LABELS[method]}", "columns": ["Variable", ""] + variables, "rows": rows, "footnotes": foot}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    variables = params.get("variables") or dataset.columns
    data = df[variables].apply(pd.to_numeric, errors="coerce")

    if params.get("method"):
        methods = [params["method"]]
    else:
        methods = [m for m in ["pearson", "spearman", "kendall"] if params.get(f"method_{m}", m == "pearson")]
    if not methods:
        methods = ["pearson"]

    tail = params.get("tail", "two")
    flag = params.get("flag_significant", True)
    if params.get("missing", "pairwise") == "listwise":
        data = data.dropna()

    tables = []
    if params.get("show_descriptives"):
        desc_rows = [[v, int(data[v].dropna().shape[0]), r(data[v].mean()), r(data[v].std(ddof=1))] for v in variables]
        tables.append({"title": "Statistiques descriptives", "columns": ["Variable", "N", "Moyenne", "Écart-type"], "rows": desc_rows})

    for m in methods:
        tables.append(_matrix(data, variables, m, tail, flag))

    out = {"title": "Corrélations", "tables": tables}
    if len(variables) == 2:
        pair = data[[variables[0], variables[1]]].dropna()
        if pair.shape[0] >= 3:
            m = methods[0]
            coef, p = _corr_fn(m)(pair[variables[0]], pair[variables[1]])
            if tail == "one":
                p = p / 2
            out["apa"] = apa.correlation_pair(variables[0], variables[1], coef, pair.shape[0], p,
                                              METHOD_LABELS[m].split(" ")[0])
    return out
