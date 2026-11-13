from typing import Any
import ast
import operator
import re
import warnings
import numpy as np
import pandas as pd

from dataset import Dataset

def _col(*a):
    return np.vstack([np.atleast_1d(np.asarray(x, dtype=float)) for x in a])


def _rowwise(fn):
    def run(*a):
        m = _col(*a)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            out = fn(m)
        out = np.asarray(out, dtype=float)
        out[np.all(np.isnan(m), axis=0)] = np.nan
        return out
    return run


def _with_min_valid(fn):
    def run(n, *a):
        m = _col(*a)
        out = fn(*a)
        out = np.asarray(out, dtype=float)
        out[np.sum(~np.isnan(m), axis=0) < int(n)] = np.nan
        return out
    return run


_STAT_NAMES = ["mean", "sum", "sd", "std", "variance", "median", "min", "max"]


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
    "mean": _rowwise(lambda m: np.nanmean(m, axis=0)),
    "sum": _rowwise(lambda m: np.nansum(m, axis=0)),
    "sd": _rowwise(lambda m: np.nanstd(m, axis=0, ddof=1)),
    "std": _rowwise(lambda m: np.nanstd(m, axis=0, ddof=1)),
    "variance": _rowwise(lambda m: np.nanvar(m, axis=0, ddof=1)),
    "median": _rowwise(lambda m: np.nanmedian(m, axis=0)),
    "min": _rowwise(lambda m: np.nanmin(m, axis=0)),
    "max": _rowwise(lambda m: np.nanmax(m, axis=0)),
    "nvalid": lambda *a: np.sum(~np.isnan(_col(*a)), axis=0).astype(float),
    "nmiss": lambda *a: np.sum(np.isnan(_col(*a)), axis=0).astype(float),
}

for _n in _STAT_NAMES:
    SAFE_FUNCS[f"__min_{_n}"] = _with_min_valid(SAFE_FUNCS[_n])


def _expand(expression: str, columns: list[str]) -> str:
    lower = {c.lower(): c for c in columns}

    def to_range(m):
        a, b = lower.get(m.group(1).lower()), lower.get(m.group(2).lower())
        if a is None or b is None:
            raise ValueError(f"variable inconnue dans « {m.group(0)} »")
        i, j = columns.index(a), columns.index(b)
        if i > j:
            i, j = j, i
        return ", ".join(columns[i:j + 1])

    expression = re.sub(r"\b([A-Za-z_][\w]*)\s+TO\s+([A-Za-z_][\w]*)\b", to_range, expression, flags=re.IGNORECASE)
    names = "|".join(_STAT_NAMES)
    expression = re.sub(rf"\b({names})\.(\d+)\s*\(", lambda m: f"__min_{m.group(1).lower()}({m.group(2)}, ", expression, flags=re.IGNORECASE)
    expression = re.sub(rf"\b({names}|nvalid|nmiss)\s*\(", lambda m: m.group(1).lower() + "(", expression, flags=re.IGNORECASE)
    return expression


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
        expression = _expand(expression, list(df.columns))
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
            raw = _eval(ast.parse(_expand(condition, list(df.columns)), mode="eval"), env)
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


def _num(value: Any):
    try:
        f = float(value)
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _bound(value: Any, low: bool) -> float:
    if value is None or str(value).strip().lower() in ("", "lowest", "lo", "min", "highest", "hi", "max"):
        return -np.inf if low else np.inf
    return float(value)


def _apply_rules(series, rules, keep_else: bool, else_value):
    out = []
    for v in series:
        key = _norm(v)
        x = _num(v)
        missing = key == ""
        hit = False
        res = None
        for rule in rules:
            kind = rule.get("kind", "value")
            if kind == "missing" and missing:
                hit, res = True, rule["to"]
            elif kind == "range" and x is not None and _bound(rule.get("from"), True) <= x <= _bound(rule.get("to_value"), False):
                hit, res = True, rule["to"]
            elif kind == "value" and not missing and (_norm(rule.get("from")) == key or (x is not None and _num(rule.get("from")) == x)):
                hit, res = True, rule["to"]
            elif kind == "else" and not missing:
                hit, res = True, rule["to"]
            if hit:
                break
        if hit:
            out.append(None if res is None or res == "" else res)
        elif keep_else:
            out.append(None if missing else v)
        else:
            out.append(else_value)
    return out


def recode(dataset: Dataset, params: dict[str, Any]) -> dict[str, Any]:
    df = dataset.to_frame()
    sources = params.get("sources") or [params["source"]]
    rules = params.get("rules", [])
    keep_else = params.get("keep_else", True)
    else_value = params.get("else_value")
    for src in sources:
        if src not in df.columns:
            return {"error": f"Variable introuvable : {src}"}
    columns = {src: _apply_rules(df[src], rules, keep_else, else_value) for src in sources}
    if "source" in params and not params.get("sources"):
        return {"values": columns[sources[0]]}
    return {"columns": columns}
