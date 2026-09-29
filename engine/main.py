import sys
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

import webengine

app = FastAPI(title="PsyStat Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    analysis: str
    dataset: dict[str, Any]
    params: dict[str, Any] = {}
    split: list[str] = []
    weight: str | None = None


class TransformRequest(BaseModel):
    transform: str
    dataset: dict[str, Any]
    params: dict[str, Any] = {}


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "analyses": webengine.analyses_list()}


@app.post("/run")
def run(req: AnalysisRequest) -> dict[str, Any]:
    return webengine.dispatch_run(req.analysis, req.dataset, req.params, req.split, req.weight)


@app.post("/transform")
def do_transform(req: TransformRequest) -> dict[str, Any]:
    return webengine.dispatch_transform(req.transform, req.dataset, req.params)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
