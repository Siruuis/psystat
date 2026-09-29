from typing import Any
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from dataset import Dataset
from analyses.util import r


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    variables = params["variables"]
    k = int(params.get("k", 3))
    standardize = params.get("standardize", True)

    data = df[variables].apply(pd.to_numeric, errors="coerce").dropna()
    if data.shape[0] < k:
        return {"title": "Nuées dynamiques", "error": "Trop peu d'observations pour ce nombre de classes."}

    X = StandardScaler().fit_transform(data) if standardize else data.values
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(X)
    labels = km.labels_

    centers = pd.DataFrame(km.cluster_centers_, columns=variables)
    if standardize:
        note = "Centres exprimés en scores standardisés (z)."
    else:
        note = "Centres exprimés dans l'unité d'origine."

    center_rows = []
    for i in range(k):
        center_rows.append([f"Classe {i + 1}"] + [r(centers.iloc[i][v]) for v in variables])
    centers_table = {
        "title": "Centres finaux des classes",
        "columns": ["Classe"] + variables,
        "rows": center_rows,
        "footnotes": [note],
    }

    sizes = pd.Series(labels).value_counts().sort_index()
    size_table = {
        "title": "Effectifs par classe",
        "columns": ["Classe", "N", "%"],
        "rows": [[f"Classe {i + 1}", int(sizes.get(i, 0)), r(100 * sizes.get(i, 0) / len(labels), 1)] for i in range(k)],
    }

    return {"title": "Classification par nuées dynamiques (K-means)", "tables": [size_table, centers_table]}
