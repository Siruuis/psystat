from typing import Any
import numpy as np
import pandas as pd
import pingouin as pg
from scipy import stats

from dataset import Dataset
from analyses.util import r


def _two_groups(df, dv, group, dataset):
    work = df[[dv, group]].copy()
    work[dv] = pd.to_numeric(work[dv], errors="coerce")
    work = work.dropna()
    levels = sorted(pd.unique(work[group]),
                    key=lambda x: (float(x) if str(x).replace(".", "", 1).lstrip("-").isdigit() else str(x)))
    labels = dataset.value_labels(group)
    return work, levels, labels


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    kind = params.get("kind", "mannwhitney")

    if kind == "mannwhitney":
        dv, group = params["dependent"], params["group"]
        work, levels, labels = _two_groups(df, dv, group, dataset)
        if len(levels) != 2:
            return {"title": "Mann-Whitney", "error": "La variable de groupe doit avoir 2 modalités."}
        a = work[work[group] == levels[0]][dv]
        b = work[work[group] == levels[1]][dv]
        res = pg.mwu(a, b)
        n1, n2 = len(a), len(b)
        u = float(res["U-val"].iloc[0])
        mu = n1 * n2 / 2
        sigma = (n1 * n2 * (n1 + n2 + 1) / 12) ** 0.5
        z = (u - mu) / sigma if sigma else 0
        w_stat = min(u, n1 * n2 - u)
        return {"title": "Test U de Mann-Whitney", "tables": [{
            "title": "Test U de Mann-Whitney (échantillons indépendants)",
            "columns": ["U de Mann-Whitney", "W de Wilcoxon", "Z", "p (bilat.)", "RBC (taille d'effet)", "CLES"],
            "rows": [[r(u), r(w_stat), r(z), r(res["p-val"].iloc[0]), r(res["RBC"].iloc[0]), r(res["CLES"].iloc[0])]],
            "footnotes": [f"Groupes : {labels.get(str(levels[0]), levels[0])} vs {labels.get(str(levels[1]), levels[1])}"],
        }]}

    if kind == "wilcoxon":
        v1, v2 = params["variable1"], params["variable2"]
        pair = df[[v1, v2]].apply(pd.to_numeric, errors="coerce").dropna()
        res = pg.wilcoxon(pair[v1], pair[v2])
        return {"title": "Test de Wilcoxon", "tables": [{
            "title": "Test des rangs signés de Wilcoxon (échantillons appariés)",
            "columns": ["W", "p", "RBC", "CLES"],
            "rows": [[r(res["W-val"].iloc[0]), r(res["p-val"].iloc[0]), r(res["RBC"].iloc[0]), r(res["CLES"].iloc[0])]],
        }]}

    if kind == "kruskal":
        dv, group = params["dependent"], params["group"]
        work = df[[dv, group]].copy()
        work[dv] = pd.to_numeric(work[dv], errors="coerce")
        work = work.dropna()
        res = pg.kruskal(data=work, dv=dv, between=group)
        return {"title": "Kruskal-Wallis", "tables": [{
            "title": "Test H de Kruskal-Wallis",
            "columns": ["Source", "ddl", "H", "p"],
            "rows": [[group, int(res["ddof1"].iloc[0]), r(res["H"].iloc[0]), r(res["p-unc"].iloc[0])]],
        }]}

    if kind == "friedman":
        within = params["within"]
        data = df[within].apply(pd.to_numeric, errors="coerce").copy()
        data["__subj"] = range(len(data))
        long = data.melt(id_vars="__subj", value_vars=within, var_name="__cond", value_name="__val").dropna()
        res = pg.friedman(data=long, dv="__val", within="__cond", subject="__subj")
        return {"title": "Friedman", "tables": [{
            "title": "Test de Friedman (mesures répétées)",
            "columns": ["Q (Chi²)", "ddl", "p", "Kendall's W"],
            "rows": [[r(res["Q"].iloc[0]), int(res["ddof1"].iloc[0]), r(res["p-unc"].iloc[0]), r(res.get("W", pd.Series([None])).iloc[0])]],
        }]}

    if kind == "chi2_gof":
        var = params["variable"]
        labels = dataset.value_labels(var)
        counts = df[var].dropna().value_counts().sort_index()
        expected = [counts.sum() / len(counts)] * len(counts)
        chi2, p = stats.chisquare(counts.values, expected)
        rows = [[labels.get(str(i), str(i)), int(c), r(e, 1)] for i, c, e in zip(counts.index, counts.values, expected)]
        return {"title": "Khi-deux d'ajustement", "tables": [
            {"title": f"Effectifs — {var}", "columns": ["Valeur", "Observé", "Attendu"], "rows": rows},
            {"title": "Test du Khi-deux", "columns": ["Chi²", "ddl", "p"],
             "rows": [[r(chi2), len(counts) - 1, r(p)]], "footnotes": ["Hypothèse : répartition uniforme."]},
        ]}

    if kind == "binomial":
        var = params["variable"]
        success = params.get("success_value")
        prop = float(params.get("test_prop", 0.5))
        s = df[var].dropna()
        n = len(s)
        k = int((s.astype(str) == str(success)).sum()) if success is not None else int(s.sum())
        res = stats.binomtest(k, n, prop)
        return {"title": "Test binomial", "tables": [{
            "title": "Test binomial",
            "columns": ["N", "Succès", "Proportion observée", "Proportion test", "p"],
            "rows": [[n, k, r(k / n if n else 0), prop, r(res.pvalue)]],
        }]}

    if kind == "ks_1sample":
        var = params["variable"]
        s = pd.to_numeric(df[var], errors="coerce").dropna()
        try:
            from statsmodels.stats.diagnostic import lilliefors
            d, p = lilliefors(s, dist="norm")
            note = "Correction de signification de Lilliefors (paramètres estimés)."
        except Exception:
            d, p = stats.kstest(s, "norm", args=(s.mean(), s.std(ddof=1)))
            note = ""
        return {"title": "Kolmogorov-Smirnov", "tables": [{
            "title": f"Test K-S de normalité — {var}",
            "columns": ["N", "D", "p", "Normalité (p > .05)"],
            "rows": [[len(s), r(d), r(p), "oui" if p > 0.05 else "non"]],
            "footnotes": [note] if note else [],
        }]}

    if kind == "runs":
        var = params["variable"]
        s = pd.to_numeric(df[var], errors="coerce").dropna().values
        med = np.median(s)
        binv = (s >= med).astype(int)
        runs = 1 + int((binv[1:] != binv[:-1]).sum())
        n1 = int(binv.sum())
        n2 = len(binv) - n1
        if n1 == 0 or n2 == 0:
            return {"title": "Test des séries", "error": "Variable constante autour de la médiane."}
        mu = 1 + 2 * n1 * n2 / (n1 + n2)
        sigma = ((2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / ((n1 + n2) ** 2 * (n1 + n2 - 1))) ** 0.5
        cc = -0.5 if runs > mu else 0.5
        z = (runs - mu + cc) / sigma if sigma else 0
        p = 2 * (1 - stats.norm.cdf(abs(z)))
        return {"title": "Test des séries", "tables": [{
            "title": f"Test des séries (randomness) — {var}",
            "columns": ["N", "Séries observées", "Séries attendues", "z", "p"],
            "rows": [[len(s), runs, r(mu), r(z), r(p)]],
        }]}

    if kind == "mcnemar":
        from statsmodels.stats.contingency_tables import mcnemar as sm_mcnemar

        v1, v2 = params["variable1"], params["variable2"]
        pair = df[[v1, v2]].dropna()
        table = pd.crosstab(pair[v1], pair[v2])
        res = sm_mcnemar(table.values, exact=True)
        return {"title": "McNemar", "tables": [{
            "title": "Test de McNemar (deux mesures appariées binaires)",
            "columns": ["Statistique", "p"],
            "rows": [[r(res.statistic), r(res.pvalue)]],
        }]}

    if kind == "cochran":
        from statsmodels.stats.contingency_tables import cochrans_q

        within = params["within"]
        data = df[within].apply(pd.to_numeric, errors="coerce").dropna()
        res = cochrans_q(data.values)
        return {"title": "Cochran Q", "tables": [{
            "title": "Test Q de Cochran (k mesures répétées binaires)",
            "columns": ["Q", "ddl", "p"],
            "rows": [[r(res.statistic), len(within) - 1, r(res.pvalue)]],
        }]}

    if kind == "sign":
        v1, v2 = params["variable1"], params["variable2"]
        pair = df[[v1, v2]].apply(pd.to_numeric, errors="coerce").dropna()
        diff = pair[v1] - pair[v2]
        pos = int((diff > 0).sum())
        neg = int((diff < 0).sum())
        res = stats.binomtest(pos, pos + neg, 0.5) if (pos + neg) else None
        return {"title": "Test des signes", "tables": [{
            "title": "Test des signes (deux mesures appariées)",
            "columns": ["Différences +", "Différences -", "Ex-aequo", "p"],
            "rows": [[pos, neg, int((diff == 0).sum()), r(res.pvalue) if res else None]],
        }]}

    return {"title": "Test non paramétrique", "error": f"Type inconnu : {kind}"}
