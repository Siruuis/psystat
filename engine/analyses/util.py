from typing import Any
import numpy as np
import pandas as pd


def r(value: Any, digits: int = 3) -> Any:
    if value is None:
        return None
    try:
        if np.isnan(value):
            return None
    except (TypeError, ValueError):
        return value
    return round(float(value), digits)


def sig(p: float) -> str:
    if p is None:
        return ""
    if p < 0.001:
        return "< .001"
    return str(round(p, 3))


def df_to_table(df: pd.DataFrame, mapping: list[tuple[str, str]], title: str, footnotes=None) -> dict:
    columns = [label for _, label in mapping]
    rows = []
    for _, row in df.iterrows():
        line = []
        for key, _ in mapping:
            val = row.get(key) if key in row else None
            if isinstance(val, (int, np.integer)):
                line.append(int(val))
            elif isinstance(val, (float, np.floating)):
                line.append(r(val))
            else:
                line.append(None if val is None or (isinstance(val, float) and np.isnan(val)) else str(val))
        rows.append(line)
    table = {"title": title, "columns": columns, "rows": rows}
    if footnotes:
        table["footnotes"] = footnotes
    return table


def numeric(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    out = df[cols].apply(pd.to_numeric, errors="coerce")
    return out
