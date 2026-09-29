from typing import Any
import pandas as pd
import pingouin as pg

from dataset import Dataset
from analyses.util import r, df_to_table, numeric


def _oneway(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    dv = params["dependent"]
    factor = params["factor"]
    work = df[[dv, factor]].copy()
    work[dv] = pd.to_numeric(work[dv], errors="coerce")
    work = work.dropna()
    labels = dataset.value_labels(factor)
    work[factor] = work[factor].apply(lambda x: labels.get(str(x), str(x)))

    post_hoc = params.get("post_hoc", "tukey")
    show_desc = params.get("show_descriptives", True)
    show_levene = params.get("levene", False)

    tables = []
    if show_desc:
        desc = work.groupby(factor)[dv].agg(["count", "mean", "std"]).reset_index()
        tables.append({
            "title": "Statistiques descriptives par groupe",
            "columns": ["Groupe", "N", "Moyenne", "Écart-type"],
            "rows": [[str(row[factor]), int(row["count"]), r(row["mean"]), r(row["std"])] for _, row in desc.iterrows()],
        })

    if show_levene:
        from scipy import stats as _st
        groups = [g[dv].values for _, g in work.groupby(factor)]
        w, p = _st.levene(*groups, center="mean")
        tables.append({
            "title": "Test d'homogénéité des variances (Levene)",
            "columns": ["Statistique de Levene", "p", "Variances égales (p > .05)"],
            "rows": [[r(w), r(p), "oui" if p > 0.05 else "non"]],
        })

    aov = pg.anova(data=work, dv=dv, between=factor, detailed=True)
    tables.append(df_to_table(
        aov,
        [("Source", "Source"), ("SS", "Somme carrés"), ("DF", "ddl"), ("MS", "Carré moyen"),
         ("F", "F"), ("p-unc", "p"), ("np2", "Eta² partiel")],
        "ANOVA à un facteur",
    ))

    if post_hoc and post_hoc != "none":
        try:
            if post_hoc == "tukey":
                ph = pg.pairwise_tukey(data=work, dv=dv, between=factor)
                tables.append(df_to_table(
                    ph,
                    [("A", "Groupe A"), ("B", "Groupe B"), ("diff", "Différence"), ("se", "Erreur std"),
                     ("T", "t"), ("p-tukey", "p ajusté"), ("hedges", "g de Hedges")],
                    "Comparaisons post-hoc (Tukey HSD)",
                ))
            else:
                ph = pg.pairwise_tests(data=work, dv=dv, between=factor, padjust=post_hoc, effsize="hedges")
                tables.append(df_to_table(
                    ph,
                    [("A", "Groupe A"), ("B", "Groupe B"), ("T", "t"), ("dof", "ddl"),
                     ("p-corr", "p ajusté"), ("hedges", "g de Hedges")],
                    f"Comparaisons post-hoc ({post_hoc})",
                ))
        except Exception:
            pass

    return {"title": "ANOVA à un facteur", "tables": tables}


def _factorial(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    dv = params["dependent"]
    factors = params["factors"]
    work = df[[dv] + factors].copy()
    work[dv] = pd.to_numeric(work[dv], errors="coerce")
    work = work.dropna()
    for f in factors:
        labels = dataset.value_labels(f)
        work[f] = work[f].apply(lambda x: labels.get(str(x), str(x)))

    aov = pg.anova(data=work, dv=dv, between=factors, ss_type=3, detailed=True)
    return {
        "title": "ANOVA factorielle",
        "tables": [df_to_table(
            aov,
            [("Source", "Source"), ("SS", "Somme carrés"), ("DF", "ddl"), ("MS", "Carré moyen"),
             ("F", "F"), ("p-unc", "p"), ("np2", "Eta² partiel")],
            "ANOVA factorielle (effets et interactions)",
        )],
    }


def _repeated(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    within = params["within"]
    data = numeric(df, within).copy()
    data["__subj"] = range(len(data))
    long = data.melt(id_vars="__subj", value_vars=within, var_name="__cond", value_name="__val").dropna()

    desc_rows = []
    for c in within:
        s = pd.to_numeric(df[c], errors="coerce").dropna()
        desc_rows.append([c, int(s.shape[0]), r(s.mean()), r(s.std(ddof=1))])
    desc_table = {
        "title": "Statistiques descriptives par condition",
        "columns": ["Condition", "N", "Moyenne", "Écart-type"],
        "rows": desc_rows,
    }

    aov = pg.rm_anova(data=long, dv="__val", within="__cond", subject="__subj", correction=True, detailed=True)
    aov_table = df_to_table(
        aov,
        [("Source", "Source"), ("SS", "Somme carrés"), ("DF", "ddl"), ("MS", "Carré moyen"),
         ("F", "F"), ("p-unc", "p (sphéricité supposée)"), ("p-GG-corr", "p (Greenhouse-Geisser)"),
         ("np2", "Eta² partiel"), ("eps", "Epsilon (GG)")],
        "ANOVA à mesures répétées",
    )

    tables = [desc_table, aov_table]
    try:
        sph = pg.sphericity(data=long, dv="__val", within="__cond", subject="__subj")
        tables.append({
            "title": "Test de sphéricité de Mauchly",
            "columns": ["W", "Chi²", "ddl", "p", "Sphéricité respectée"],
            "rows": [[r(sph.W), r(sph.chi2), r(sph.dof, 1), r(sph.pval), "oui" if sph.spher else "non"]],
        })
    except Exception:
        pass

    return {"title": "ANOVA à mesures répétées", "tables": tables}


def _ancova(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    dv = params["dependent"]
    factor = params["factor"]
    covariates = params["covariates"]
    work = df[[dv, factor] + covariates].copy()
    for c in [dv] + covariates:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna()
    labels = dataset.value_labels(factor)
    work[factor] = work[factor].apply(lambda x: labels.get(str(x), str(x)))

    aov = pg.ancova(data=work, dv=dv, between=factor, covar=covariates)
    return {
        "title": "ANCOVA",
        "tables": [df_to_table(
            aov,
            [("Source", "Source"), ("SS", "Somme carrés"), ("DF", "ddl"),
             ("F", "F"), ("p-unc", "p"), ("np2", "Eta² partiel")],
            "ANCOVA (analyse de covariance)",
            footnotes=[f"Covariable(s) : {', '.join(covariates)}."],
        )],
    }


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "oneway")
    if kind == "factorial":
        return _factorial(dataset, params)
    if kind == "repeated":
        return _repeated(dataset, params)
    if kind == "ancova":
        return _ancova(dataset, params)
    return _oneway(dataset, params)
