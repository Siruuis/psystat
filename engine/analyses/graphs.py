from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from dataset import Dataset
from charts import new_axes, figure_to_png, BLUE, GREY


def _hist(series, title):
    fig, ax = new_axes()
    data = series.dropna()
    ax.hist(data, bins="auto", color=BLUE, alpha=0.85, edgecolor="white")
    if data.std() > 0:
        x = np.linspace(data.min(), data.max(), 100)
        y = stats.norm.pdf(x, data.mean(), data.std())
        y = y * len(data) * (data.max() - data.min()) / max(1, len(np.histogram_bin_edges(data, "auto")) - 1)
        ax.plot(x, y, color="#e4572e", lw=1.6)
    ax.set_title(title)
    ax.set_ylabel("Effectif")
    return figure_to_png(fig)


def _box(df, variables, group, dataset):
    fig, ax = new_axes(5.6, 3.6)
    if group:
        labels = dataset.value_labels(group)
        dv = variables[0]
        groups = []
        names = []
        for lvl, sub in df.groupby(group):
            groups.append(pd.to_numeric(sub[dv], errors="coerce").dropna())
            names.append(labels.get(str(lvl), str(lvl)))
        ax.boxplot(groups, labels=names, patch_artist=True,
                   boxprops=dict(facecolor="#dbe6fb", color=BLUE), medianprops=dict(color="#e4572e"))
        ax.set_ylabel(dv)
    else:
        data = [pd.to_numeric(df[v], errors="coerce").dropna() for v in variables]
        ax.boxplot(data, labels=variables, patch_artist=True,
                   boxprops=dict(facecolor="#dbe6fb", color=BLUE), medianprops=dict(color="#e4572e"))
    ax.set_title("Boîte à moustaches")
    return figure_to_png(fig)


def _scatter(df, x, y):
    fig, ax = new_axes()
    xd = pd.to_numeric(df[x], errors="coerce")
    yd = pd.to_numeric(df[y], errors="coerce")
    mask = xd.notna() & yd.notna()
    ax.scatter(xd[mask], yd[mask], color=BLUE, alpha=0.7, edgecolor="white")
    if mask.sum() > 2:
        b, a = np.polyfit(xd[mask], yd[mask], 1)
        xs = np.linspace(xd[mask].min(), xd[mask].max(), 50)
        ax.plot(xs, a + b * xs, color="#e4572e", lw=1.6)
    ax.set_xlabel(x)
    ax.set_ylabel(y)
    ax.set_title(f"Nuage de points : {y} selon {x}")
    return figure_to_png(fig)


def _qq(series, title):
    fig, ax = new_axes()
    stats.probplot(series.dropna(), dist="norm", plot=ax)
    ax.get_lines()[0].set_color(BLUE)
    ax.get_lines()[1].set_color("#e4572e")
    ax.set_title(title)
    return figure_to_png(fig)


def _pp(series, title):
    fig, ax = new_axes()
    data = np.sort(series.dropna())
    n = len(data)
    emp = (np.arange(1, n + 1) - 0.5) / n
    theo = stats.norm.cdf(data, np.mean(data), np.std(data))
    ax.scatter(theo, emp, color=BLUE, alpha=0.7, edgecolor="white")
    ax.plot([0, 1], [0, 1], color="#e4572e", lw=1.4)
    ax.set_xlabel("Probabilité théorique")
    ax.set_ylabel("Probabilité observée")
    ax.set_title(title)
    return figure_to_png(fig)


def _bar(df, variable, dataset):
    fig, ax = new_axes()
    labels = dataset.value_labels(variable)
    counts = df[variable].dropna().value_counts().sort_index()
    names = [labels.get(str(i), str(i)) for i in counts.index]
    ax.bar(names, counts.values, color=BLUE, alpha=0.85)
    ax.set_ylabel("Effectif")
    ax.set_title(f"Diagramme en barres : {variable}")
    return figure_to_png(fig)


def run(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    kind = params.get("kind", "histogram")
    images = []

    if kind == "histogram":
        for v in params.get("variables", []):
            images.append({"title": f"Histogramme — {v}", "src": _hist(pd.to_numeric(df[v], errors="coerce"), v)})
    elif kind == "boxplot":
        images.append({"title": "Boîte à moustaches", "src": _box(df, params["variables"], params.get("group"), dataset)})
    elif kind == "scatter":
        images.append({"title": "Nuage de points", "src": _scatter(df, params["x"], params["y"])})
    elif kind == "qqplot":
        for v in params.get("variables", []):
            images.append({"title": f"Q-Q — {v}", "src": _qq(pd.to_numeric(df[v], errors="coerce"), f"Tracé Q-Q normal : {v}")})
    elif kind == "ppplot":
        for v in params.get("variables", []):
            images.append({"title": f"P-P — {v}", "src": _pp(pd.to_numeric(df[v], errors="coerce"), f"Tracé P-P normal : {v}")})
    elif kind == "bar":
        for v in params.get("variables", []):
            images.append({"title": f"Barres — {v}", "src": _bar(df, v, dataset)})

    titles = {"histogram": "Histogrammes", "boxplot": "Boîte à moustaches", "scatter": "Nuage de points",
              "qqplot": "Tracés Q-Q", "ppplot": "Tracés P-P", "bar": "Diagrammes en barres"}
    return {"title": titles.get(kind, "Graphique"), "images": images}
