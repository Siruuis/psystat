from typing import Any
import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_val_predict
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import confusion_matrix, accuracy_score

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png


def _num_key(x):
    try:
        return (0, float(x))
    except (TypeError, ValueError):
        return (1, str(x)), BLUE


def _hierarchical(dataset, params):
    df = dataset.to_frame()
    variables = params["variables"]
    k = int(params.get("k", 3))
    data = df[variables].apply(pd.to_numeric, errors="coerce").dropna()
    X = StandardScaler().fit_transform(data)
    Z = linkage(X, method="ward")
    clusters = fcluster(Z, k, criterion="maxclust")
    fig, ax = new_axes(6, 3.8)
    dendrogram(Z, ax=ax, color_threshold=Z[-(k - 1), 2] if k > 1 else 0, no_labels=True)
    ax.set_title("Dendrogramme (méthode de Ward)")
    ax.set_ylabel("Distance")
    sizes = pd.Series(clusters).value_counts().sort_index()
    return {"title": "Classification hiérarchique", "tables": [{
        "title": "Effectifs par classe",
        "columns": ["Classe", "N"],
        "rows": [[int(i), int(c)] for i, c in sizes.items()],
    }], "images": [{"title": "Dendrogramme", "src": figure_to_png(fig)}]}


def _confusion(y, pred, cats, names, title):
    cm = confusion_matrix(y, pred, labels=cats)
    cm_rows = [[names[i]] + [int(v) for v in cm[i]] for i in range(len(cats))]
    return {"title": title, "columns": ["Observé \\ Prédit"] + names, "rows": cm_rows}


def _supervised(dataset, params, kind):
    df = dataset.to_frame()
    predictors = params["predictors"]
    group = params["group"]
    work = df[predictors + [group]].copy()
    for c in predictors:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna()
    X = work[predictors].values
    y = work[group].astype(str).values
    labels_map = dataset.value_labels(group)
    cats = sorted(pd.unique(y), key=_num_key)
    names = [labels_map.get(str(c), str(c)) for c in cats]

    if kind == "discriminant":
        est = LinearDiscriminantAnalysis()
    elif kind == "knn":
        est = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=int(params.get("k", 5))))
    else:
        est = make_pipeline(StandardScaler(),
                            MLPClassifier(hidden_layer_sizes=(int(params.get("hidden", 8)),), max_iter=1000, random_state=0))

    est.fit(X, y)
    resub_acc = accuracy_score(y, est.predict(X))

    min_class = pd.Series(y).value_counts().min()
    folds = int(min(5, min_class))
    cv_acc = None
    cv_pred = None
    if folds >= 2:
        try:
            cv_pred = cross_val_predict(est, X, y, cv=folds)
            cv_acc = accuracy_score(y, cv_pred)
        except Exception:
            cv_pred = None

    titles = {"discriminant": "Analyse discriminante", "knn": "k plus proches voisins", "neural": "Réseau de neurones (MLP)"}
    summary = {
        "title": "Récapitulatif de la classification",
        "columns": ["Précision (apprentissage)", "Précision (validation croisée)"],
        "rows": [[f"{round(resub_acc*100,1)} %", f"{round(cv_acc*100,1)} %" if cv_acc is not None else "n/a"]],
        "footnotes": ["La précision en validation croisée est l'estimation honnête (non optimiste)."],
    }
    tables = [summary, _confusion(y, est.predict(X), cats, names, "Matrice de classification (apprentissage)")]
    if cv_pred is not None:
        tables.append(_confusion(y, cv_pred, cats, names, f"Matrice de classification (validation croisée {folds} plis)"))

    if kind == "discriminant":
        scal = est.scalings_
        n_func = min(scal.shape[1], len(cats) - 1, len(predictors))
        coef_rows = [[predictors[i]] + [r(scal[i][j]) for j in range(n_func)] for i in range(len(predictors))]
        tables.append({
            "title": "Coefficients des fonctions discriminantes canoniques",
            "columns": ["Prédicteur"] + [f"Fonction {j+1}" for j in range(n_func)],
            "rows": coef_rows,
        })
    return {"title": titles[kind], "tables": tables}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "hierarchical")
    if kind == "hierarchical":
        return _hierarchical(dataset, params)
    return _supervised(dataset, params, kind)
