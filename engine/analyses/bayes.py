from typing import Any
import pandas as pd
import pingouin as pg

from dataset import Dataset
from analyses.util import r


def _interpret_bf(bf):
    if bf is None:
        return ""
    if bf > 100:
        return "preuve décisive (H1)"
    if bf > 10:
        return "preuve forte (H1)"
    if bf > 3:
        return "preuve modérée (H1)"
    if bf > 1:
        return "preuve anecdotique (H1)"
    if bf > 1 / 3:
        return "preuve anecdotique (H0)"
    return "preuve pour H0"


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    kind = params.get("kind", "ttest")

    if kind == "correlation":
        x = pd.to_numeric(df[params["x"]], errors="coerce")
        y = pd.to_numeric(df[params["y"]], errors="coerce")
        res = pg.corr(x, y)
        bf = float(res["BF10"].iloc[0]) if "BF10" in res else None
        return {"title": "Corrélation bayésienne", "tables": [{
            "title": "Corrélation bayésienne (Pearson)",
            "columns": ["r", "p", "BF10", "Interprétation"],
            "rows": [[r(res["r"].iloc[0]), r(res["p-val"].iloc[0]), r(bf), _interpret_bf(bf)]],
        }]}

    dv = params["dependent"]
    group = params["group"]
    work = df[[dv, group]].copy()
    work[dv] = pd.to_numeric(work[dv], errors="coerce")
    work = work.dropna()
    levels = sorted(pd.unique(work[group]),
                    key=lambda x: (float(x) if str(x).replace(".", "", 1).lstrip("-").isdigit() else str(x)))
    if len(levels) != 2:
        return {"title": "Test t bayésien", "error": "La variable de groupe doit avoir 2 modalités."}
    a = work[work[group] == levels[0]][dv]
    b = work[work[group] == levels[1]][dv]
    res = pg.ttest(a, b)
    bf = float(res["BF10"].iloc[0])
    return {"title": "Test t bayésien", "tables": [{
        "title": "Test t bayésien (échantillons indépendants)",
        "columns": ["t", "ddl", "p", "BF10", "Interprétation"],
        "rows": [[r(res["T"].iloc[0]), r(res["dof"].iloc[0], 1), r(res["p-val"].iloc[0]), r(bf), _interpret_bf(bf)]],
        "footnotes": ["BF10 > 3 : preuve en faveur d'une différence ; BF10 < 1/3 : en faveur de l'absence de différence."],
    }]}
