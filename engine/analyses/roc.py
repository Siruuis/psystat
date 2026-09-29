from typing import Any
import pandas as pd
from sklearn.metrics import roc_curve, roc_auc_score

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png, BLUE


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    actual = pd.to_numeric(df[params["actual"]], errors="coerce")
    score = pd.to_numeric(df[params["predictor"]], errors="coerce")
    mask = actual.notna() & score.notna()
    a = actual[mask]
    x = score[mask]
    cats = sorted(pd.unique(a))
    if len(cats) != 2:
        return {"title": "Courbe ROC", "error": "La variable d'état doit avoir exactement 2 modalités."}
    positive = params.get("positive_value")
    pos_val = float(positive) if positive not in (None, "") else cats[1]
    y = (a == pos_val).astype(int)
    note = f"État positif = {pos_val}."
    auc = roc_auc_score(y, x)
    if auc < 0.5:
        note += " ⚠ AUC < .5 : la variable de test est associée négativement (des valeurs plus faibles indiquent l'état positif)."
    fpr, tpr, thr = roc_curve(y, x)
    fig, ax = new_axes()
    ax.plot(fpr, tpr, color=BLUE, lw=2, label=f"AUC = {round(auc, 3)}")
    ax.plot([0, 1], [0, 1], color="#999", ls="--", lw=1)
    ax.set_xlabel("1 - Spécificité")
    ax.set_ylabel("Sensibilité")
    ax.set_title("Courbe ROC")
    ax.legend(fontsize=9)
    step = max(1, len(thr) // 12)
    rows = [[r(thr[i], 3), r(tpr[i], 3), r(1 - fpr[i], 3)] for i in range(1, len(thr), step)]
    return {"title": "Courbe ROC", "tables": [
        {"title": "Aire sous la courbe", "columns": ["AUC"], "rows": [[r(auc)]],
         "footnotes": ["AUC : .5 = hasard, .7-.8 acceptable, > .9 excellent.", note]},
        {"title": "Coordonnées (échantillon)", "columns": ["Seuil", "Sensibilité", "Spécificité"], "rows": rows},
    ], "images": [{"title": "ROC", "src": figure_to_png(fig)}]}
