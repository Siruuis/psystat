from typing import Any
import json

from dataset import Dataset
from analyses import (
    descriptives,
    ttest,
    correlation,
    anova,
    reliability,
    nonparametric,
    frequencies,
    crosstabs,
    regression,
    graphs,
    explore,
    means,
    partial_corr,
    efa,
    cluster,
    glm,
    classify,
    dimension,
    forecast,
    survival,
    roc,
    bayes,
    reports,
    qc,
    decision_tree,
    loglinear,
)
import transform

REGISTRY = {
    "descriptives": descriptives.run,
    "frequencies": frequencies.run,
    "explore": explore.run,
    "means": means.run,
    "ttest": ttest.run,
    "anova": anova.run,
    "correlation": correlation.run,
    "partial_corr": partial_corr.run,
    "crosstabs": crosstabs.run,
    "reliability": reliability.run,
    "efa": efa.run,
    "cluster": cluster.run,
    "nonparametric": nonparametric.run,
    "regression": regression.run,
    "glm": glm.run,
    "classify": classify.run,
    "dimension": dimension.run,
    "forecast": forecast.run,
    "survival": survival.run,
    "roc": roc.run,
    "bayes": bayes.run,
    "reports": reports.run,
    "qc": qc.run,
    "decision_tree": decision_tree.run,
    "loglinear": loglinear.run,
    "graphs": graphs.run,
}

TRANSFORMS = {
    "compute": transform.compute,
    "recode": transform.recode,
}


def analyses_list() -> list[str]:
    return list(REGISTRY.keys())


_ERROR_MAP = [
    ("one-dimensional", "La variable dépendante doit être une seule variable numérique. Vérifiez qu'aucune variable n'est sélectionnée en double (et qu'il n'existe pas deux variables portant le même nom)."),
    ("perfect separation", "Séparation parfaite : un prédicteur prédit trop parfaitement l'issue. Retirez-le ou ajoutez des données."),
    ("singular matrix", "Modèle inestimable : des prédicteurs sont redondants ou trop corrélés (colinéarité). Retirez un prédicteur."),
    ("linalgerror", "Calcul impossible (matrice singulière) : prédicteurs trop corrélés ou données insuffisantes."),
    ("must have at least", "Pas assez d'observations valides pour cette analyse."),
    ("at least", "Pas assez d'observations valides pour cette analyse."),
    ("zero-size array", "Aucune donnée valide (variables vides ou entièrement manquantes)."),
    ("cannot convert", "Une variable choisie n'est pas numérique. Choisissez des variables numériques."),
    ("could not convert", "Une variable choisie n'est pas numérique. Choisissez des variables numériques."),
    ("input contains nan", "Trop de valeurs manquantes dans les variables choisies."),
    ("contains nan", "Trop de valeurs manquantes dans les variables choisies."),
    ("out of bounds", "Pas assez de groupes ou de données pour cette analyse."),
    ("empty", "Aucune donnée à analyser. Vérifiez votre sélection."),
    ("negative", "Des valeurs négatives empêchent ce calcul (ex. log ou racine)."),
    ("identical", "Une variable est constante (toutes les valeurs identiques) : le calcul est impossible."),
    ("degrees of freedom", "Pas assez de données (degrés de liberté insuffisants) pour ce test."),
]


def _friendly(exc: Exception) -> str:
    msg = str(exc)
    low = msg.lower()
    for key, fr in _ERROR_MAP:
        if key in low:
            return fr
    if isinstance(exc, KeyError):
        return f"Variable introuvable ({msg}). Vérifiez votre sélection de variables."
    if isinstance(exc, (ValueError, TypeError)) and len(msg) < 140:
        return f"Impossible d'effectuer l'analyse : {msg}. Vérifiez vos variables et vos données."
    return "Impossible d'effectuer l'analyse. Vérifiez que vos variables sont numériques, non constantes, et qu'il y a assez de données valides."


def _expand_weight(ds: Dataset, weight: str | None) -> Dataset:
    if not weight or weight not in ds.columns:
        return ds
    expanded = []
    for row in ds.rows:
        try:
            w = int(round(float(row.get(weight))))
        except (TypeError, ValueError):
            w = 0
        expanded.extend([row] * max(0, w))
    return Dataset(columns=ds.columns, rows=expanded, meta=ds.meta)


def _split_groups(ds: Dataset, split: list[str]):
    labels = {s: ds.value_labels(s) for s in split}
    groups: dict[tuple, list] = {}
    for row in ds.rows:
        key = tuple(row.get(s) for s in split)
        groups.setdefault(key, []).append(row)

    def _num(v):
        try:
            return (0, float(v))
        except (TypeError, ValueError):
            return (1, str(v))

    out = []
    for key in sorted(groups, key=lambda k: tuple(_num(v) for v in k)):
        parts = [f"{s} = {labels[s].get(str(v), v)}" for s, v in zip(split, key)]
        out.append((", ".join(parts), Dataset(columns=ds.columns, rows=groups[key], meta=ds.meta)))
    return out


def dispatch_run(analysis, dataset_dict, params=None, split=None, weight=None) -> dict[str, Any]:
    fn = REGISTRY.get(analysis)
    if fn is None:
        return {"error": f"Analyse inconnue : {analysis}"}
    params = params or {}
    split = split or []
    try:
        ds = _expand_weight(Dataset(**dataset_dict), weight)
        if not split:
            return fn(ds, params)
        tables: list[Any] = []
        images: list[Any] = []
        title = None
        for label, sub in _split_groups(ds, split):
            res = fn(sub, params)
            title = title or res.get("title")
            if res.get("error"):
                tables.append({"title": f"[{label}]", "columns": ["Erreur"], "rows": [[res["error"]]]})
                continue
            for t in res.get("tables", []):
                nt = dict(t)
                nt["title"] = f"[{label}] {t.get('title', '')}"
                tables.append(nt)
            for im in res.get("images", []):
                ni = dict(im)
                ni["title"] = f"[{label}] {im.get('title', '')}"
                images.append(ni)
        return {"title": title or analysis, "tables": tables, "images": images}
    except Exception as exc:
        return {"error": _friendly(exc)}


def dispatch_transform(name, dataset_dict, params=None) -> dict[str, Any]:
    fn = TRANSFORMS.get(name)
    if fn is None:
        return {"error": f"Transformation inconnue : {name}"}
    try:
        return fn(Dataset(**dataset_dict), params or {})
    except Exception as exc:
        return {"error": _friendly(exc)}


def run_json(payload_json: str) -> str:
    req = json.loads(payload_json)
    result = dispatch_run(req["analysis"], req["dataset"], req.get("params", {}),
                          req.get("split", []), req.get("weight"))
    return json.dumps(result, ensure_ascii=False, default=str)


def transform_json(payload_json: str) -> str:
    req = json.loads(payload_json)
    result = dispatch_transform(req["transform"], req["dataset"], req.get("params", {}))
    return json.dumps(result, ensure_ascii=False, default=str)
