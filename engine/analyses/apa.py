import numpy as np


def _num(v):
    try:
        f = float(v)
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return None


def f2(v, d=2):
    v = _num(v)
    return "NA" if v is None else f"{v:.{d}f}"


def fp(p):
    p = _num(p)
    if p is None:
        return "p = NA"
    if p < 0.001:
        return "p < .001"
    s = f"{p:.3f}"
    return "p = " + (s[1:] if s.startswith("0") else s)


def fr(v, d=2):
    v = _num(v)
    if v is None:
        return "NA"
    s = f"{v:.{d}f}"
    if s.startswith("0."):
        return s[1:]
    if s.startswith("-0."):
        return "-" + s[2:]
    return s


def _sig(p):
    p = _num(p)
    return p is not None and p < 0.05


def _verdict(p):
    return "La différence est statistiquement significative." if _sig(p) else "La différence n'est pas statistiquement significative."


def ttest_independent(name_a, ma, sda, name_b, mb, sdb, t, df, p, d):
    concl = _verdict(p)
    return (
        f"Un test t pour échantillons indépendants a été réalisé pour comparer « {name_a} » "
        f"(M = {f2(ma)}, ET = {f2(sda)}) et « {name_b} » (M = {f2(mb)}, ET = {f2(sdb)}). "
        f"t({f2(df, 1)}) = {f2(t)}, {fp(p)}, d de Cohen = {f2(d)}. {concl}"
    )


def ttest_paired(v1, m1, sd1, v2, m2, sd2, t, df, p, d):
    concl = _verdict(p)
    return (
        f"Un test t pour échantillons appariés a été réalisé pour comparer « {v1} » "
        f"(M = {f2(m1)}, ET = {f2(sd1)}) et « {v2} » (M = {f2(m2)}, ET = {f2(sd2)}). "
        f"t({f2(df, 1)}) = {f2(t)}, {fp(p)}, d de Cohen = {f2(d)}. {concl}"
    )


def ttest_one(var, m, sd, popmean, t, df, p, d):
    concl = "La moyenne diffère significativement de la valeur test." if _sig(p) else "La moyenne ne diffère pas significativement de la valeur test."
    return (
        f"Un test t pour échantillon unique a comparé « {var} » (M = {f2(m)}, ET = {f2(sd)}) "
        f"à la valeur test {f2(popmean)}. t({f2(df, 1)}) = {f2(t)}, {fp(p)}, d de Cohen = {f2(d)}. {concl}"
    )


def anova_oneway(factor, dv, f_val, df1, df2, p, eta2):
    concl = "L'effet du facteur est statistiquement significatif." if _sig(p) else "L'effet du facteur n'est pas statistiquement significatif."
    eta = f", η² partiel = {fr(eta2)}" if _num(eta2) is not None else ""
    return (
        f"Une ANOVA à un facteur a examiné l'effet de « {factor} » sur « {dv} ». "
        f"F({f2(df1, 0)}, {f2(df2, 0)}) = {f2(f_val)}, {fp(p)}{eta}. {concl}"
    )


def correlation_pair(va, vb, r, n, p, method="Pearson"):
    df = n - 2 if _num(n) is not None else None
    df_txt = f"({f2(df, 0)})" if df is not None else ""
    force = "forte" if abs(_num(r) or 0) >= 0.5 else ("modérée" if abs(_num(r) or 0) >= 0.3 else "faible")
    sens = "positive" if (_num(r) or 0) >= 0 else "négative"
    concl = f"La corrélation est significative, {sens} et {force}." if _sig(p) else "La corrélation n'est pas statistiquement significative."
    return (
        f"Une corrélation de {method} a été calculée entre « {va} » et « {vb} ». "
        f"r{df_txt} = {fr(r)}, {fp(p)}. {concl}"
    )
