from typing import Any
import ast
import operator
import numpy as np
import pandas as pd

from dataset import Dataset

def _col(*a):
    return np.vstack([np.asarray(x, dtype=float) for x in a])


SAFE_FUNCS = {
    # arithmétique
    "abs": np.abs,
    "sqrt": np.sqrt,
    "exp": np.exp,
    "ln": np.log,
    "log": np.log,
    "log10": np.log10,
    "lg10": np.log10,
    "round": np.round,
    "rnd": np.round,
    "trunc": np.trunc,
    "mod": np.mod,
    # trigonométrie
    "sin": np.sin,
    "cos": np.cos,
    "tan": np.tan,
    "arsin": np.arcsin,
    "artan": np.arctan,
    # statistiques (sur plusieurs variables d'une même observation)
    "mean": lambda *a: np.nanmean(_col(*a), axis=0),
    "sum": lambda *a: np.nansum(_col(*a), axis=0),
    "sd": lambda *a: np.nanstd(_col(*a), axis=0, ddof=1),
    "std": lambda *a: np.nanstd(_col(*a), axis=0, ddof=1),
    "variance": lambda *a: np.nanvar(_col(*a), axis=0, ddof=1),
    "median": lambda *a: np.nanmedian(_col(*a), axis=0),
    "min": lambda *a: np.nanmin(_col(*a), axis=0),
    "max": lambda *a: np.nanmax(_col(*a), axis=0),
}

_BIN = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
    ast.BitAnd: operator.and_, ast.BitOr: operator.or_,
}
_CMP = {
    ast.Gt: operator.gt, ast.Lt: operator.lt, ast.GtE: operator.ge,
    ast.LtE: operator.le, ast.Eq: operator.eq, ast.NotEq: operator.ne,
}


def _eval(node, env):
    if isinstance(node, ast.Expression):
        return _eval(node.body, env)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError("constante non autorisée")
    if isinstance(node, ast.Name):
        if node.id in env:
            return env[node.id]
        raise ValueError(f"nom inconnu : {node.id}")
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
        return _BIN[type(node.op)](_eval(node.left, env), _eval(node.right, env))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        v = _eval(node.operand, env)
        return +v if isinstance(node.op, ast.UAdd) else -v
    if isinstance(node, ast.Compare) and len(node.ops) == 1 and type(node.ops[0]) in _CMP:
        return _CMP[type(node.ops[0])](_eval(node.left, env), _eval(node.comparators[0], env))
    if isinstance(node, ast.BoolOp):
        vals = [_eval(v, env) for v in node.values]
        res = vals[0]
        for v in vals[1:]:
            res = (res & v) if isinstance(node.op, ast.And) else (res | v)
        return res
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in SAFE_FUNCS:
        return SAFE_FUNCS[node.func.id](*[_eval(a, env) for a in node.args])
    raise ValueError("expression non autorisée")


def compute(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    expression = params["expression"]
    env: dict[str, Any] = {}
    for col in df.columns:
        env[col] = pd.to_numeric(df[col], errors="coerce").to_numpy(dtype=float)
    try:
        tree = ast.parse(expression, mode="eval")
        result = _eval(tree, env)
    except Exception as exc:
        return {"error": f"Expression invalide : {exc}"}
    arr = np.asarray(result, dtype=float)
    if arr.ndim == 0:
        arr = np.full(len(df), float(arr))

    condition = params.get("condition")
    if condition:
        try:
            raw = _eval(ast.parse(condition, mode="eval"), env)
        except Exception as exc:
            return {"error": f"Condition invalide : {exc}"}
        cond = np.asarray(raw)
        cond = cond != 0 if cond.dtype != bool else cond
        cond = np.nan_to_num(cond.astype(float), nan=0).astype(bool)
        name = params.get("name")
        existing = (
            pd.to_numeric(df[name], errors="coerce").to_numpy(dtype=float)
            if name and name in df.columns
            else np.full(len(df), np.nan)
        )
        arr = np.where(cond, arr, existing)

    values = [None if (v is None or (isinstance(v, float) and np.isnan(v))) else float(v) for v in arr]
    return {"values": values}


def _norm(value: Any) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def recode(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    source = params["source"]
    rules = params.get("rules", [])
    else_value = params.get("else_value")
    keep_else = params.get("keep_else", True)

    mapping = {_norm(rule["from"]): rule["to"] for rule in rules}
    out = []
    for v in df[source]:
        key = _norm(v)
        if key in mapping:
            out.append(mapping[key])
        elif keep_else:
            out.append(None if key == "" else v)
        else:
            out.append(else_value)
    return {"values": out}
