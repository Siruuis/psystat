from typing import Any
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor, export_text, plot_tree
from sklearn.metrics import confusion_matrix, accuracy_score

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    target = params["target"]
    predictors = params["predictors"]
    max_depth = int(params.get("max_depth", 3))
    mode = params.get("mode", "classification")

    work = df[predictors + [target]].copy()
    for c in predictors:
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna()
    X = work[predictors].values

    if mode == "regression":
        y = pd.to_numeric(work[target], errors="coerce")
        tree = DecisionTreeRegressor(max_depth=max_depth, min_samples_leaf=max(2, len(work) // 20)).fit(X, y)
        pred = tree.predict(X)
        ss_res = float(np.sum((y - pred) ** 2))
        ss_tot = float(np.sum((y - y.mean()) ** 2))
        r2 = 1 - ss_res / ss_tot if ss_tot else 0
        summary = {"title": "Récapitulatif", "columns": ["R² (apprentissage)", "Profondeur", "Feuilles"],
                   "rows": [[r(r2), tree.get_depth(), tree.get_n_leaves()]]}
        class_names = None
    else:
        y = work[target].astype(str).values
        labels = dataset.value_labels(target)
        tree = DecisionTreeClassifier(max_depth=max_depth, min_samples_leaf=max(2, len(work) // 20), random_state=0).fit(X, y)
        pred = tree.predict(X)
        acc = accuracy_score(y, pred)
        cats = sorted(pd.unique(y))
        class_names = [labels.get(str(c), str(c)) for c in cats]
        cm = confusion_matrix(y, pred, labels=cats)
        summary = {"title": "Récapitulatif", "columns": ["Précision (apprentissage)", "Profondeur", "Feuilles"],
                   "rows": [[f"{round(acc*100,1)} %", tree.get_depth(), tree.get_n_leaves()]]}

    importance = {
        "title": "Importance des variables",
        "columns": ["Variable", "Importance"],
        "rows": sorted([[predictors[i], r(tree.feature_importances_[i])] for i in range(len(predictors))],
                       key=lambda x: -(x[1] or 0)),
    }

    tables = [summary, importance]
    if mode != "regression":
        tables.append({"title": "Matrice de classification", "columns": ["Observé \\ Prédit"] + class_names,
                       "rows": [[class_names[i]] + [int(v) for v in cm[i]] for i in range(len(class_names))]})

    fig, ax = new_axes(8, 5)
    plot_tree(tree, feature_names=predictors, class_names=class_names, filled=True, fontsize=7, ax=ax, rounded=True)
    ax.set_title("Arbre de décision (CART)")
    rules = export_text(tree, feature_names=list(predictors))

    tables.append({"title": "Règles de l'arbre", "columns": ["Structure"],
                   "rows": [[line] for line in rules.split("\n") if line.strip()]})

    return {"title": "Arbre de décision", "tables": tables, "images": [{"title": "Arbre", "src": figure_to_png(fig)}]}
