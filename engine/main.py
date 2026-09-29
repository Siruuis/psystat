import sys
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

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

app = FastAPI(title="PsyStat Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


class AnalysisRequest(BaseModel):
    analysis: str
    dataset: Dataset
    params: dict[str, Any] = {}
    split: list[str] = []
    weight: str | None = None


def _expand_weight(ds: Dataset, weight: str | None) -> Dataset:
    if not weight or weight not in ds.columns:
        return ds
    expanded = []
    for row in ds.rows:
        raw = row.get(weight)
        try:
            w = int(round(float(raw)))
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


class TransformRequest(BaseModel):
    transform: str
    dataset: Dataset
    params: dict[str, Any] = {}


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "analyses": list(REGISTRY.keys())}


@app.post("/run")
def run(req: AnalysisRequest) -> dict[str, Any]:
    fn = REGISTRY.get(req.analysis)
    if fn is None:
        return {"error": f"Analyse inconnue : {req.analysis}"}
    try:
        ds = _expand_weight(req.dataset, req.weight)
        if not req.split:
            return fn(ds, req.params)

        tables: list[Any] = []
        images: list[Any] = []
        title = None
        for label, sub in _split_groups(ds, req.split):
            res = fn(sub, req.params)
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
        return {"title": title or req.analysis, "tables": tables, "images": images}
    except Exception as exc:
        return {"error": str(exc)}


@app.post("/transform")
def do_transform(req: TransformRequest) -> dict[str, Any]:
    fn = TRANSFORMS.get(req.transform)
    if fn is None:
        return {"error": f"Transformation inconnue : {req.transform}"}
    try:
        return fn(req.dataset, req.params)
    except Exception as exc:
        return {"error": str(exc)}


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
