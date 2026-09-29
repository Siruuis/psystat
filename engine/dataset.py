from typing import Any, Optional
import numpy as np
import pandas as pd
from pydantic import BaseModel


class VariableMeta(BaseModel):
    name: str
    type: str = "numeric"
    measure: str = "scale"
    label: Optional[str] = None
    labels: dict[str, str] = {}
    missing: list[Any] = []


class Dataset(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    meta: dict[str, VariableMeta] = {}

    def to_frame(self) -> pd.DataFrame:
        df = pd.DataFrame(self.rows, columns=self.columns)
        for name, meta in self.meta.items():
            if name not in df.columns:
                continue
            if meta.type == "numeric":
                df[name] = pd.to_numeric(df[name], errors="coerce")
                if meta.missing:
                    codes = [pd.to_numeric(m, errors="coerce") for m in meta.missing]
                    df[name] = df[name].replace([c for c in codes if pd.notna(c)], np.nan)
            elif meta.missing:
                df[name] = df[name].replace([str(m) for m in meta.missing], np.nan)
        return df

    def value_labels(self, name: str) -> dict[str, str]:
        meta = self.meta.get(name)
        if not meta:
            return {}
        out: dict[str, str] = {}
        for key, label in meta.labels.items():
            out[key] = label
            try:
                f = float(key)
                out[str(f)] = label
                if f.is_integer():
                    out[str(int(f))] = label
            except (TypeError, ValueError):
                pass
        return out
