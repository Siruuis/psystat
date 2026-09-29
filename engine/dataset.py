from typing import Any
import numpy as np
import pandas as pd


class Dataset:
    def __init__(self, columns: list[str], rows: list[dict[str, Any]], meta: dict[str, dict] | None = None):
        self.columns = columns
        self.rows = rows
        self.meta = meta or {}

    def _meta(self, name: str) -> dict:
        return self.meta.get(name, {})

    def to_frame(self) -> pd.DataFrame:
        df = pd.DataFrame(self.rows, columns=self.columns)
        for name in self.columns:
            meta = self._meta(name)
            vtype = meta.get("type", "numeric")
            missing = meta.get("missing", []) or []
            if vtype == "numeric":
                df[name] = pd.to_numeric(df[name], errors="coerce")
                if missing:
                    codes = [pd.to_numeric(m, errors="coerce") for m in missing]
                    df[name] = df[name].replace([c for c in codes if pd.notna(c)], np.nan)
            elif missing:
                df[name] = df[name].replace([str(m) for m in missing], np.nan)
        return df

    def value_labels(self, name: str) -> dict[str, str]:
        labels = self._meta(name).get("labels", {}) or {}
        out: dict[str, str] = {}
        for key, label in labels.items():
            out[key] = label
            try:
                f = float(key)
                out[str(f)] = label
                if f.is_integer():
                    out[str(int(f))] = label
            except (TypeError, ValueError):
                pass
        return out
