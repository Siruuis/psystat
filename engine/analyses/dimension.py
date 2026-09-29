from typing import Any
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.manifold import MDS

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png, BLUE


def _pca(dataset, params):
    df = dataset.to_frame()
    variables = params["variables"]
    data = df[variables].apply(pd.to_numeric, errors="coerce").dropna()
    X = StandardScaler().fit_transform(data)
    pca = PCA().fit(X)
    R = np.corrcoef(data.values.T)
    ev = np.sort(np.linalg.eigvalsh(R))[::-1]
    ev = np.clip(ev, 0, None)
    ratio = ev / ev.sum()
    cum = np.cumsum(ratio)
    var_rows = [[f"Composante {i+1}", r(ev[i]), r(ratio[i]*100, 1), r(cum[i]*100, 1)] for i in range(len(ev))]
    n_keep = int(params.get("n_components", sum(ev >= 1)))
    n_keep = max(1, min(n_keep, len(variables)))
    load = pca.components_[:n_keep].T * np.sqrt(ev[:n_keep])
    load_rows = [[variables[i]] + [r(load[i, j]) for j in range(n_keep)] for i in range(len(variables))]
    fig, ax = new_axes()
    ax.plot(range(1, len(ev)+1), ev, "o-", color=BLUE)
    ax.axhline(1, color="#e4572e", ls="--", lw=1)
    ax.set_xlabel("Composante")
    ax.set_ylabel("Valeur propre")
    ax.set_title("Graphique des éboulis (ACP)")
    return {"title": "Analyse en composantes principales", "tables": [
        {"title": "Variance expliquée", "columns": ["Composante", "Valeur propre", "% variance", "% cumulé"], "rows": var_rows},
        {"title": "Saturations des composantes", "columns": ["Variable"] + [f"CP{j+1}" for j in range(n_keep)], "rows": load_rows},
    ], "images": [{"title": "Éboulis", "src": figure_to_png(fig)}]}


def _correspondence(dataset, params):
    df = dataset.to_frame()
    row_var, col_var = params["row"], params["column"]
    work = df[[row_var, col_var]].dropna()
    rl = dataset.value_labels(row_var)
    cl = dataset.value_labels(col_var)
    ct = pd.crosstab(work[row_var], work[col_var])
    N = ct.values.sum()
    P = ct.values / N
    rm = P.sum(axis=1)
    cm = P.sum(axis=0)
    E = np.outer(rm, cm)
    S = (P - E) / np.sqrt(E)
    U, s, Vt = np.linalg.svd(S, full_matrices=False)
    inertia = s ** 2
    total = inertia.sum()
    dims = min(2, len(s))
    row_coords = (U[:, :dims] * s[:dims]) / np.sqrt(rm)[:, None]
    col_coords = (Vt.T[:, :dims] * s[:dims]) / np.sqrt(cm)[:, None]
    fig, ax = new_axes(5.4, 4)
    for i, idx in enumerate(ct.index):
        ax.scatter(row_coords[i, 0], row_coords[i, 1] if dims > 1 else 0, color=BLUE)
        ax.annotate(rl.get(str(idx), str(idx)), (row_coords[i, 0], row_coords[i, 1] if dims > 1 else 0), fontsize=8, color=BLUE)
    for j, idx in enumerate(ct.columns):
        ax.scatter(col_coords[j, 0], col_coords[j, 1] if dims > 1 else 0, color="#e4572e", marker="^")
        ax.annotate(cl.get(str(idx), str(idx)), (col_coords[j, 0], col_coords[j, 1] if dims > 1 else 0), fontsize=8, color="#e4572e")
    ax.axhline(0, color="#ccc", lw=0.8)
    ax.axvline(0, color="#ccc", lw=0.8)
    ax.set_title("Carte des correspondances")
    inertia_rows = [[f"Dimension {i+1}", r(inertia[i]), r(inertia[i]/total*100, 1)] for i in range(len(s))]
    return {"title": "Analyse des correspondances", "tables": [
        {"title": "Inertie par dimension", "columns": ["Dimension", "Inertie", "% inertie"], "rows": inertia_rows},
    ], "images": [{"title": "Carte", "src": figure_to_png(fig)}]}


def _mds(dataset, params):
    df = dataset.to_frame()
    variables = params["variables"]
    data = df[variables].apply(pd.to_numeric, errors="coerce").dropna()
    X = StandardScaler().fit_transform(data)
    mds = MDS(n_components=2, random_state=0, normalized_stress="auto")
    coords = mds.fit_transform(X)
    fig, ax = new_axes()
    ax.scatter(coords[:, 0], coords[:, 1], color=BLUE, alpha=0.7, edgecolor="white")
    ax.set_title("Positionnement multidimensionnel (MDS)")
    ax.set_xlabel("Dimension 1")
    ax.set_ylabel("Dimension 2")
    return {"title": "Positionnement multidimensionnel", "tables": [
        {"title": "Qualité", "columns": ["Stress"], "rows": [[r(mds.stress_, 3)]]},
    ], "images": [{"title": "Carte MDS", "src": figure_to_png(fig)}]}


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    kind = params.get("kind", "pca")
    if kind == "correspondence":
        return _correspondence(dataset, params)
    if kind == "mds":
        return _mds(dataset, params)
    return _pca(dataset, params)
