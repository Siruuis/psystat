from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from dataset import Dataset
from analyses.util import r, sig


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    row_var = params["row"]
    col_var = params["column"]
    work = df[[row_var, col_var]].dropna().copy()

    row_labels = dataset.value_labels(row_var)
    col_labels = dataset.value_labels(col_var)
    work[row_var] = work[row_var].apply(lambda x: row_labels.get(str(x), str(x)))
    work[col_var] = work[col_var].apply(lambda x: col_labels.get(str(x), str(x)))

    ct = pd.crosstab(work[row_var], work[col_var], margins=True, margins_name="Total")
    columns = [row_var] + [str(c) for c in ct.columns]
    rows = [[str(idx)] + [int(v) for v in ct.loc[idx]] for idx in ct.index]
    cross_table = {"title": f"Tableau croisé {row_var} × {col_var}", "columns": columns, "rows": rows}

    tables = [cross_table]

    observed = pd.crosstab(work[row_var], work[col_var]).values
    if observed.shape[0] >= 2 and observed.shape[1] >= 2:
        n = observed.sum()
        chi2, p, dof, expected = stats.chi2_contingency(observed, correction=False)
        lr, p_lr, _, _ = stats.chi2_contingency(observed, lambda_="log-likelihood", correction=False)
        min_exp = float(expected.min())
        n_low = int((expected < 5).sum())
        total_cells = expected.size
        cramer = np.sqrt(chi2 / (n * (min(observed.shape) - 1)))

        test_rows = [
            ["Khi-deux de Pearson", r(chi2), int(dof), sig(p)],
            ["Rapport de vraisemblance", r(lr), int(dof), sig(p_lr)],
        ]
        if observed.shape == (2, 2):
            chi2_y, p_y, _, _ = stats.chi2_contingency(observed, correction=True)
            odds, p_fisher = stats.fisher_exact(observed)
            test_rows.insert(1, ["Correction de continuité (Yates)", r(chi2_y), 1, sig(p_y)])
            test_rows.append(["Test exact de Fisher (bilatéral)", "", "", sig(p_fisher)])

        tables.append({
            "title": "Tests du Khi-deux",
            "columns": ["Test", "Valeur", "ddl", "p"],
            "rows": test_rows,
            "footnotes": [
                f"V de Cramér = {r(cramer)}   (~.1 faible, ~.3 moyen, ~.5 fort).",
                f"{n_low} cellule(s) sur {total_cells} ont un effectif attendu < 5 (min = {r(min_exp, 2)}).",
            ],
        })

    return {"title": "Tableaux croisés", "tables": tables}
