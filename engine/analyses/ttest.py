from typing import Any
import numpy as np
import pandas as pd
import pingouin as pg

from dataset import Dataset


def _r(v, d=3):
    try:
        return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), d)
    except (TypeError, ValueError):
        return v


def _result_table(res: pd.DataFrame, extra: dict[str, Any]) -> dict[str, Any]:
    row = res.iloc[0]
    ci = row.get("CI95%")
    ci_txt = f"[{_r(ci[0])} ; {_r(ci[1])}]" if ci is not None else None
    columns = ["Test", "t", "ddl", "p", "d de Cohen", "IC 95% (diff.)", "Puissance"]
    values = [
        extra["label"],
        _r(row["T"]),
        _r(row["dof"], 1),
        _r(row["p-val"]),
        _r(row["cohen-d"]),
        ci_txt,
        _r(row.get("power")),
    ]
    return {"title": "Résultat du test t", "columns": columns, "rows": [values],
            "footnotes": [extra.get("footnote", "")]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    kind = params.get("kind", "independent")
    tables = []

    if kind == "one_sample":
        var = params["variable"]
        popmean = float(params.get("popmean", 0))
        x = pd.to_numeric(df[var], errors="coerce").dropna()
        res = pg.ttest(x, popmean)
        tables.append({
            "title": "Statistiques du groupe",
            "columns": ["Variable", "N", "Moyenne", "Écart-type", "Test contre"],
            "rows": [[var, int(x.shape[0]), _r(x.mean()), _r(x.std(ddof=1)), popmean]],
        })
        tables.append(_result_table(res, {
            "label": f"{var} vs {popmean}",
            "footnote": f"Test t pour échantillon unique (valeur test = {popmean}).",
        }))

    elif kind == "paired":
        v1, v2 = params["variable1"], params["variable2"]
        pair = df[[v1, v2]].apply(pd.to_numeric, errors="coerce").dropna()
        res = pg.ttest(pair[v1], pair[v2], paired=True)
        tables.append({
            "title": "Statistiques des variables appariées",
            "columns": ["Variable", "N", "Moyenne", "Écart-type"],
            "rows": [
                [v1, int(pair.shape[0]), _r(pair[v1].mean()), _r(pair[v1].std(ddof=1))],
                [v2, int(pair.shape[0]), _r(pair[v2].mean()), _r(pair[v2].std(ddof=1))],
            ],
        })
        tables.append(_result_table(res, {
            "label": f"{v1} - {v2}",
            "footnote": "Test t pour échantillons appariés.",
        }))

    else:
        from scipy import stats as _st

        dv = params["dependent"]
        group = params["group"]
        work = df[[dv, group]].copy()
        work[dv] = pd.to_numeric(work[dv], errors="coerce")
        work = work.dropna()
        levels = sorted(pd.unique(work[group]), key=lambda x: (float(x) if str(x).replace(".", "", 1).lstrip("-").isdigit() else str(x)))
        if len(levels) != 2:
            return {"title": "Test t", "error": "La variable de groupe doit avoir exactement 2 modalités."}
        labels = dataset.value_labels(group)
        a = work[work[group] == levels[0]][dv]
        b = work[work[group] == levels[1]][dv]
        name_a = labels.get(str(levels[0]), str(levels[0]))
        name_b = labels.get(str(levels[1]), str(levels[1]))
        tables.append({
            "title": "Statistiques de groupe",
            "columns": ["Groupe", "N", "Moyenne", "Écart-type", "Erreur std"],
            "rows": [
                [name_a, int(a.shape[0]), _r(a.mean()), _r(a.std(ddof=1)), _r(a.std(ddof=1) / np.sqrt(a.shape[0]))],
                [name_b, int(b.shape[0]), _r(b.mean()), _r(b.std(ddof=1)), _r(b.std(ddof=1) / np.sqrt(b.shape[0]))],
            ],
        })

        lev_w, lev_p = _st.levene(a, b, center="mean")
        tables.append({
            "title": "Test de Levene sur l'égalité des variances",
            "columns": ["F", "p", "Variances égales (p > .05)"],
            "rows": [[_r(lev_w), _r(lev_p), "oui" if lev_p > 0.05 else "non"]],
        })

        student = pg.ttest(a, b, paired=False, correction=False)
        welch = pg.ttest(a, b, paired=False, correction=True)
        diff = a.mean() - b.mean()

        def _row(label, res):
            ci = res["CI95%"].iloc[0]
            return [label, _r(res["T"].iloc[0]), _r(res["dof"].iloc[0], 1), _r(res["p-val"].iloc[0]),
                    _r(diff), f"[{_r(ci[0])} ; {_r(ci[1])}]", _r(res["cohen-d"].iloc[0])]

        tables.append({
            "title": f"Test t pour échantillons indépendants ({name_a} vs {name_b})",
            "columns": ["Hypothèse", "t", "ddl", "p (bilat.)", "Différence moy.", "IC 95% (diff.)", "d de Cohen"],
            "rows": [
                _row("Variances égales supposées", student),
                _row("Variances égales non supposées", welch),
            ],
            "footnotes": ["Si Levene est significatif (p < .05), lisez la ligne « variances non supposées » (Welch)."],
        })

    return {"title": "Test t", "tables": tables}
