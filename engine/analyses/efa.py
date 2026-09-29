from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from dataset import Dataset
from analyses.util import r
from charts import new_axes, figure_to_png, BLUE


def _varimax(phi, gamma=1.0, iters=100, tol=1e-6):
    p, k = phi.shape
    if k < 2:
        return phi
    rot = np.eye(k)
    d = 0
    for _ in range(iters):
        d_old = d
        lam = phi @ rot
        diag = np.diag((lam ** 2).sum(axis=0))
        u, s, vt = np.linalg.svd(phi.T @ (lam ** 3 - (gamma / p) * lam @ diag))
        rot = u @ vt
        d = s.sum()
        if d_old != 0 and d / d_old < 1 + tol:
            break
    return phi @ rot


def _kmo(R):
    inv = np.linalg.pinv(R)
    d = np.sqrt(np.outer(np.diag(inv), np.diag(inv)))
    partial = -inv / d
    np.fill_diagonal(partial, 0)
    off = R.copy()
    np.fill_diagonal(off, 0)
    num = (off ** 2).sum()
    return num / (num + (partial ** 2).sum())


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    items = params["items"]
    n_factors = int(params.get("n_factors", 2))
    rotation = params.get("rotation", "varimax")

    data = df[items].apply(pd.to_numeric, errors="coerce").dropna()
    n, p = data.shape
    if n < p + 2:
        return {"title": "Analyse factorielle", "error": "Trop peu d'observations complètes."}
    n_factors = max(1, min(n_factors, p))

    R = np.corrcoef(data.values.T)
    det = np.linalg.det(R)
    chi2 = -(n - 1 - (2 * p + 5) / 6) * np.log(max(det, 1e-12))
    dfb = p * (p - 1) / 2
    p_bart = float(stats.chi2.sf(chi2, dfb))
    kmo = _kmo(R)

    adequacy = {
        "title": "Qualité d'échantillonnage et test de Bartlett",
        "columns": ["Indice", "Valeur", "Interprétation"],
        "rows": [
            ["Indice KMO", r(kmo), "> .60 acceptable, > .80 bon"],
            ["Bartlett Chi²", r(chi2), f"ddl = {int(dfb)}"],
            ["Bartlett p", r(p_bart), "< .05 : factorisation justifiée"],
        ],
    }

    eigvals, eigvecs = np.linalg.eigh(R)
    order = np.argsort(eigvals)[::-1]
    eigvals = eigvals[order]
    eigvecs = eigvecs[:, order]

    loadings = eigvecs[:, :n_factors] * np.sqrt(np.maximum(eigvals[:n_factors], 0))
    if rotation == "varimax":
        h = np.sqrt((loadings ** 2).sum(axis=1))
        h[h == 0] = 1
        loadings = _varimax(loadings / h[:, None]) * h[:, None]

    communalities = (loadings ** 2).sum(axis=1)
    var_rot = (loadings ** 2).sum(axis=0)

    factor_names = [f"Facteur {i + 1}" for i in range(n_factors)]
    load_rows = [[item] + [r(loadings[i, j]) for j in range(n_factors)] + [r(communalities[i])]
                 for i, item in enumerate(items)]
    loadings_table = {
        "title": "Matrice des saturations" + (" (rotation varimax)" if rotation == "varimax" else ""),
        "columns": ["Item"] + factor_names + ["Communalité"],
        "rows": load_rows,
        "footnotes": ["Saturations |.40| et plus généralement retenues."],
    }

    variance_table = {
        "title": "Variance expliquée",
        "columns": ["Facteur", "Valeur propre initiale", "% variance", "% cumulé"],
        "rows": [[factor_names[j], r(eigvals[j]), r(var_rot[j] / p * 100, 1),
                  r(float(np.cumsum(var_rot)[j]) / p * 100, 1)] for j in range(n_factors)],
    }

    fig, ax = new_axes()
    ax.plot(range(1, p + 1), eigvals, "o-", color=BLUE)
    ax.axhline(1, color="#e4572e", ls="--", lw=1)
    ax.set_xlabel("Facteur")
    ax.set_ylabel("Valeur propre")
    ax.set_title("Graphique des éboulis (scree plot)")
    scree = {"title": "Graphique des éboulis", "src": figure_to_png(fig)}

    return {
        "title": "Analyse factorielle exploratoire",
        "tables": [adequacy, variance_table, loadings_table],
        "images": [scree],
    }
