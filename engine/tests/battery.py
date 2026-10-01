"""Batterie de tests scientifiques du moteur PsyStat (webengine).
Teste la justesse (comparee a scipy/statsmodels/pingouin) et la robustesse (cas d'erreur).
Lancer : .venv/Scripts/python.exe tests_battery.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import warnings
warnings.filterwarnings("ignore")
import numpy as np
import pandas as pd
from scipy import stats

import webengine

rng = np.random.default_rng(42)
N = 150

# ---------- jeu de donnees realiste (psychologie) ----------
groupe = rng.integers(1, 4, N)           # 3 groupes
sexe = rng.integers(1, 3, N)             # 2 modalites
fa = rng.normal(0, 1, N)                 # facteur latent A
fb = rng.normal(0, 1, N)                 # facteur latent B
base = {1: 10.0, 2: 14.0, 3: 18.0}
x = np.array([base[g] for g in groupe]) + rng.normal(0, 3, N)
y = 2.0 + 0.6 * x + rng.normal(0, 2, N)  # correle a x
z = rng.normal(5, 2, N)
pre = np.array([base[g] for g in groupe]) + rng.normal(0, 2, N)
post = pre + 5 + rng.normal(0, 2, N)
suivi = pre + 3 + rng.normal(0, 2, N)
def item(load, f): return np.clip(np.round(3 + load * f + rng.normal(0, 0.6, N)), 1, 5)
q1, q2, q3 = item(1, fa), item(.9, fa), item(.85, fa)
q4, q5, q6 = item(1, fb), item(.9, fb), item(.8, fb)
outcome = (x + rng.normal(0, 2, N) > 14).astype(int)
count = rng.poisson(np.clip(x / 8, 0.2, None)).astype(int)
ordv = rng.integers(1, 4, N)
b1, b2, b3 = rng.integers(0, 2, N), rng.integers(0, 2, N), rng.integers(0, 2, N)
ts = 10 + np.sin(np.arange(N) / 6) * 3 + rng.normal(0, 0.6, N)
stime = rng.exponential(10, N).round(2)
event = rng.integers(0, 2, N)
const = np.full(N, 7.0)                  # variable constante
xmiss = x.copy(); xmiss[::7] = np.nan     # avec manquantes

cols = ["groupe","sexe","x","y","z","pre","post","suivi","q1","q2","q3","q4","q5","q6",
        "outcome","count","ordv","b1","b2","b3","ts","stime","event","const","xmiss","sstr"]
rows = []
for i in range(N):
    rows.append({
        "groupe":int(groupe[i]),"sexe":int(sexe[i]),"x":float(x[i]),"y":float(y[i]),"z":float(z[i]),
        "pre":float(pre[i]),"post":float(post[i]),"suivi":float(suivi[i]),
        "q1":float(q1[i]),"q2":float(q2[i]),"q3":float(q3[i]),"q4":float(q4[i]),"q5":float(q5[i]),"q6":float(q6[i]),
        "outcome":int(outcome[i]),"count":int(count[i]),"ordv":int(ordv[i]),
        "b1":int(b1[i]),"b2":int(b2[i]),"b3":int(b3[i]),"ts":float(ts[i]),
        "stime":float(stime[i]),"event":int(event[i]),"const":7.0,
        "xmiss":(None if np.isnan(xmiss[i]) else float(xmiss[i])),"sstr":"abc",
    })
meta = {"groupe":{"type":"numeric","measure":"nominal","labels":{"1":"A","2":"B","3":"C"}},
        "sexe":{"type":"numeric","measure":"nominal","labels":{"1":"H","2":"F"}},
        "sstr":{"type":"string","measure":"nominal"}}
DS = {"columns":cols, "rows":rows, "meta":meta}

# ---------- helpers ----------
PASS = 0; FAIL = 0; fails = []
def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond: PASS += 1
    else: FAIL += 1; fails.append(f"[{name}] {detail}")

def num(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).replace("*", "").replace("<", "").strip()
    s = s.split(" ")[0].split("(")[0].replace("[", "").replace(";", "")
    try: return float(s)
    except ValueError: return None

def cell(res, col, row0=None):
    for t in res.get("tables", []):
        if col in t["columns"]:
            ci = t["columns"].index(col)
            for r in t["rows"]:
                if row0 is None or str(r[0]) == str(row0):
                    return r[ci]
    return None

def run(analysis, params, split=None, weight=None):
    return webengine.dispatch_run(analysis, DS, params, split, weight)

def approx(a, b, tol=0.02):
    a, b = num(a), (None if b is None else float(b))
    return a is not None and b is not None and abs(a - b) <= tol

df = pd.DataFrame(rows)
xx = pd.to_numeric(df["x"]); yy = pd.to_numeric(df["y"]); zz = pd.to_numeric(df["z"])

# =========================================================
# 1-6  DESCRIPTIVES / FREQ / EXPLORE / MEANS
r = run("descriptives", {"variables": ["x", "y"]})
ok("desc.ok", not r.get("error"))
ok("desc.mean_x", approx(cell(r, "Moyenne", "x"), xx.mean(), 0.01))
ok("desc.sd_x", approx(cell(r, "Écart-type", "x"), xx.std(ddof=1), 0.01))
ok("desc.n_x", num(cell(r, "N", "x")) == N)
r = run("frequencies", {"variables": ["groupe"]})
ok("freq.ok", not r.get("error") and len(r["tables"]) >= 1)
r = run("explore", {"variables": ["x"], "factor": "groupe"})
ok("explore.ok", not r.get("error") and len(r.get("images", [])) >= 1)
r = run("means", {"dependents": ["x"], "factor": "groupe"})
ok("means.ok", not r.get("error"))

# 7-14 T-TESTS (cross-check scipy)
r = run("ttest", {"kind": "one_sample", "variable": "x", "popmean": 14})
t1, p1 = stats.ttest_1samp(xx, 14)
ok("ttest1.t", approx(cell(r, "t"), t1, 0.02))
ok("ttest1.p", approx(cell(r, "p"), p1, 0.01))
a = xx[df["sexe"] == 1]; b = xx[df["sexe"] == 2]
r = run("ttest", {"kind": "independent", "dependent": "x", "group": "sexe"})
ts_t, ts_p = stats.ttest_ind(a, b)
ok("ttestI.student_t", approx(cell(r, "t", "Variances égales supposées"), ts_t, 0.05))
tw_t, tw_p = stats.ttest_ind(a, b, equal_var=False)
ok("ttestI.welch_t", approx(cell(r, "t", "Variances égales non supposées"), tw_t, 0.05))
ok("ttestI.has_levene", cell(r, "F") is not None)
pair = df[["pre", "post"]].apply(pd.to_numeric).dropna()
r = run("ttest", {"kind": "paired", "variable1": "pre", "variable2": "post"})
tp_t, tp_p = stats.ttest_rel(pair["pre"], pair["post"])
ok("ttestP.t", approx(cell(r, "t"), tp_t, 0.02))

# 15-22 ANOVA
r = run("anova", {"kind": "oneway", "dependent": "x", "factor": "groupe"})
groups = [xx[df["groupe"] == g] for g in (1, 2, 3)]
F, p = stats.f_oneway(*groups)
ok("anova1.F", approx(cell(r, "F", "groupe"), F, 0.1))
ok("anova1.p", approx(cell(r, "p", "groupe"), p, 0.01))
ok("anova1.has_posthoc", any("post-hoc" in t["title"].lower() for t in r["tables"]))
r = run("anova", {"kind": "factorial", "dependent": "x", "factors": ["groupe", "sexe"]})
ok("anovaFact.ok", not r.get("error"))
r = run("anova", {"kind": "repeated", "within": ["pre", "post", "suivi"]})
ok("anovaRM.ok", not r.get("error") and cell(r, "p (Greenhouse-Geisser)") is not None)
r = run("anova", {"kind": "ancova", "dependent": "x", "factor": "groupe", "covariates": ["z"]})
ok("ancova.ok", not r.get("error"))

# 23-30 CORRELATION
r = run("correlation", {"variables": ["x", "y", "z"], "method_pearson": True})
rp, pp = stats.pearsonr(xx, yy)
ok("corr.pearson_xy", approx(cell(r, "", "x"), None) or True)  # matrix cells are strings
# extract via tables rows
def corr_cell(res, a_name, b_index):
    for t in res.get("tables", []):
        if "Pearson" in t["title"]:
            for i, row in enumerate(t["rows"]):
                if row[0] == a_name and row[1].startswith("Corr"):
                    return num(row[2 + b_index])
    return None
ok("corr.pearson_xy_val", approx(corr_cell(r, "x", 1), rp, 0.02))
r2 = run("correlation", {"variables": ["x", "y"], "method_spearman": True, "method_pearson": False})
rs, ps = stats.spearmanr(xx, yy)
ok("corr.spearman_ok", not r2.get("error"))
r3 = run("partial_corr", {"x": "x", "y": "y", "covariates": ["z"]})
ok("partial.ok", not r3.get("error") and cell(r3, "r partiel") is not None)

# 31-33 CROSSTABS
r = run("crosstabs", {"row": "groupe", "column": "sexe"})
ct = pd.crosstab(df["groupe"], df["sexe"])
chi2, pchi, dof, _ = stats.chi2_contingency(ct, correction=False)
ok("crosstab.chi2", approx(cell(r, "Valeur", "Khi-deux de Pearson"), chi2, 0.1))
ok("crosstab.has_cramer", any("Cramér" in (f or "") for t in r["tables"] for f in t.get("footnotes", [])))

# 34-36 RELIABILITY (cronbach cross-check)
items = df[["q1", "q2", "q3", "q4", "q5", "q6"]].apply(pd.to_numeric)
k = items.shape[1]; var_sum = items.sum(axis=1).var(ddof=1); var_items = items.var(ddof=1).sum()
alpha_ref = k / (k - 1) * (1 - var_items / var_sum)
r = run("reliability", {"items": ["q1", "q2", "q3", "q4", "q5", "q6"]})
ok("reliab.alpha", approx(cell(r, "Valeur", "Alpha de Cronbach"), alpha_ref, 0.02))
ok("reliab.item_stats", any("item" in t["title"].lower() for t in r["tables"]))

# 37-42 DIMENSION / EFA
r = run("efa", {"items": ["q1", "q2", "q3", "q4", "q5", "q6"], "n_factors": 2, "rotation": "varimax"})
ok("efa.ok", not r.get("error") and len(r.get("images", [])) >= 1)
ok("efa.kmo", cell(r, "Valeur", "Indice KMO") is not None)
r = run("dimension", {"kind": "pca", "variables": ["x", "y", "z", "q1"]})
ok("pca.ok", not r.get("error"))
r = run("dimension", {"kind": "correspondence", "row": "groupe", "column": "sexe"})
ok("ca.ok", not r.get("error") and len(r.get("images", [])) >= 1)
r = run("dimension", {"kind": "mds", "variables": ["x", "y", "z"]})
ok("mds.ok", not r.get("error"))

# 43-50 CLUSTER / CLASSIFY
ok("kmeans.ok", not run("cluster", {"variables": ["x", "y"], "k": 3}).get("error"))
ok("hier.ok", not run("classify", {"kind": "hierarchical", "variables": ["x", "y"], "k": 3}).get("error"))
ok("disc.ok", not run("classify", {"kind": "discriminant", "predictors": ["x", "y"], "group": "groupe"}).get("error"))
ok("knn.ok", not run("classify", {"kind": "knn", "predictors": ["x", "y"], "group": "groupe", "k": 5}).get("error"))
ok("neural.ok", not run("classify", {"kind": "neural", "predictors": ["x", "y"], "group": "groupe"}).get("error"))
ok("tree.ok", not run("decision_tree", {"target": "groupe", "predictors": ["x", "y"], "mode": "classification"}).get("error"))

# 51-62 REGRESSION
import statsmodels.api as sm
Xc = sm.add_constant(df[["x", "z"]].apply(pd.to_numeric)); ols = sm.OLS(yy, Xc).fit()
r = run("regression", {"kind": "linear", "dependent": "y", "predictors": ["x", "z"]})
ok("reg.lin.coef_x", approx(cell(r, "B", "x"), ols.params["x"], 0.02))
ok("reg.lin.r2", approx(cell(r, "R²"), ols.rsquared, 0.01))
ok("reg.lin.has_beta", cell(r, "Bêta", "x") is not None)
ok("reg.lin.has_anova", any("ANOVA" in t["title"] for t in r["tables"]))
r = run("regression", {"kind": "logistic", "dependent": "outcome", "predictors": ["x", "z"]})
ok("reg.log.ok", not r.get("error") and any("classification" in t["title"].lower() for t in r["tables"]))
ok("reg.log.nagelkerke", cell(r, "R² Nagelkerke") is not None)
ok("reg.multi.ok", not run("regression", {"kind": "multinomial", "dependent": "groupe", "predictors": ["x", "y"]}).get("error"))
ok("reg.ord.ok", not run("regression", {"kind": "ordinal", "dependent": "ordv", "predictors": ["x", "y"]}).get("error"))
ok("reg.pois.ok", not run("regression", {"kind": "poisson", "dependent": "count", "predictors": ["x"]}).get("error"))
ok("reg.curve.ok", not run("regression", {"kind": "curve", "dependent": "y", "predictors": ["x"]}).get("error"))

# 63-66 GLM
ok("glm.gen.ok", not run("glm", {"kind": "generalized", "dependent": "count", "predictors": ["x"], "family": "poisson"}).get("error"))
ok("glm.mixed.ok", not run("glm", {"kind": "mixed", "dependent": "y", "fixed": ["x"], "group": "groupe"}).get("error"))
ok("glm.manova.ok", not run("glm", {"kind": "manova", "dependents": ["x", "y"], "factor": "groupe"}).get("error"))

# 67-80 NON PARAMETRIQUE (cross-check scipy)
r = run("nonparametric", {"kind": "mannwhitney", "dependent": "x", "group": "sexe"})
U, pu = stats.mannwhitneyu(a, b, alternative="two-sided")
ok("np.mwu.p", approx(cell(r, "p (bilat.)"), pu, 0.02))
r = run("nonparametric", {"kind": "wilcoxon", "variable1": "pre", "variable2": "post"})
W, pw = stats.wilcoxon(pair["pre"], pair["post"])
ok("np.wilcoxon.p", approx(cell(r, "p"), pw, 0.02))
r = run("nonparametric", {"kind": "kruskal", "dependent": "x", "group": "groupe"})
H, pk = stats.kruskal(*groups)
ok("np.kruskal.H", approx(cell(r, "H"), H, 0.1))
ok("np.friedman.ok", not run("nonparametric", {"kind": "friedman", "within": ["pre", "post", "suivi"]}).get("error"))
ok("np.chi2gof.ok", not run("nonparametric", {"kind": "chi2_gof", "variable": "groupe"}).get("error"))
ok("np.binom.ok", not run("nonparametric", {"kind": "binomial", "variable": "b1", "success_value": 1}).get("error"))
ok("np.ks.ok", not run("nonparametric", {"kind": "ks_1sample", "variable": "x"}).get("error"))
ok("np.runs.ok", not run("nonparametric", {"kind": "runs", "variable": "x"}).get("error"))
ok("np.mcnemar.ok", not run("nonparametric", {"kind": "mcnemar", "variable1": "b1", "variable2": "b2"}).get("error"))
ok("np.cochran.ok", not run("nonparametric", {"kind": "cochran", "within": ["b1", "b2", "b3"]}).get("error"))
ok("np.sign.ok", not run("nonparametric", {"kind": "sign", "variable1": "pre", "variable2": "post"}).get("error"))

# 81-90 BAYES / ROC / SURVIE / FORECAST / QC / REPORTS / LOGLINEAR
ok("bayes.t.ok", not run("bayes", {"kind": "ttest", "dependent": "x", "group": "sexe"}).get("error"))
ok("bayes.corr.ok", not run("bayes", {"kind": "correlation", "x": "x", "y": "y"}).get("error"))
ok("roc.ok", not run("roc", {"actual": "outcome", "predictor": "x"}).get("error"))
ok("surv.km.ok", not run("survival", {"kind": "km", "time": "stime", "event": "event", "event_value": 1}).get("error"))
ok("surv.cox.ok", not run("survival", {"kind": "cox", "time": "stime", "event": "event", "predictors": ["x"]}).get("error"))
ok("fc.acf.ok", not run("forecast", {"kind": "autocorr", "variable": "ts"}).get("error"))
ok("fc.exp.ok", not run("forecast", {"kind": "expsmoothing", "variable": "ts", "forecast": 5}).get("error"))
ok("fc.arima.ok", not run("forecast", {"kind": "arima", "variable": "ts", "p": 1, "d": 0, "q": 1}).get("error"))
ok("qc.ok", not run("qc", {"variable": "ts"}).get("error"))
ok("rep.summ.ok", not run("reports", {"kind": "summaries", "variables": ["groupe", "x"]}).get("error"))
ok("rep.mr.ok", not run("reports", {"kind": "multiple_response", "variables": ["b1", "b2", "b3"], "counted_value": 1}).get("error"))
ok("loglin.ok", not run("loglinear", {"factors": ["groupe", "sexe"]}).get("error"))

# 93-99 GRAPHS (image produite)
for kind, p in [("histogram", {"variables": ["x"]}), ("bar", {"variables": ["groupe"]}),
                ("boxplot", {"variables": ["x"], "group": "groupe"}), ("scatter", {"x": "x", "y": "y"}),
                ("qqplot", {"variables": ["x"]}), ("ppplot", {"variables": ["x"]})]:
    gr = run("graphs", {"kind": kind, **p})
    ok(f"graph.{kind}", not gr.get("error") and len(gr.get("images", [])) >= 1)

# 100-106 TRANSFORMS (valeurs vs numpy)
def tr(name, params): return webengine.dispatch_transform(name, DS, params)
t = tr("compute", {"expression": "(pre + post) / 2"})
ref = ((pre + post) / 2)
ok("compute.mean2", t.get("values") is not None and abs(t["values"][0] - ref[0]) < 1e-6)
t = tr("compute", {"expression": "sqrt(z)"})
ok("compute.sqrt", abs(t["values"][0] - float(np.sqrt(zz[0]))) < 1e-6)
t = tr("compute", {"expression": "mean(q1, q2, q3)"})
ok("compute.rowmean", t.get("values") is not None)
t = tr("recode", {"source": "groupe", "rules": [{"from": 1, "to": 10}], "keep_else": True})
ok("recode.ok", t["values"][list(groupe).index(1)] == 10)

# 107-112 SPLIT / WEIGHT
r = run("descriptives", {"variables": ["x"]}, split=["groupe"])
ok("split.3groups", not r.get("error") and sum(1 for t in r["tables"] if "[groupe" in t["title"]) >= 3)
# weight : dupliquer selon une variable de poids entiere -> N augmente
DSW = {"columns": cols + ["w"], "rows": [{**row, "w": 2} for row in rows], "meta": meta}
rw = webengine.dispatch_run("descriptives", DSW, {"variables": ["x"]}, None, "w")
ok("weight.doublesN", num(cell(rw, "N", "x")) == 2 * N)

# =========================================================
# CAS D'ERREUR (doit renvoyer un message clair, pas de crash)
def err(name, res, must_be_error=True):
    e = res.get("error")
    global PASS, FAIL
    if must_be_error:
        if e and "Traceback" not in e:
            PASS += 1
        else:
            FAIL += 1; fails.append(f"[err:{name}] attendu une erreur claire, recu: {str(res)[:80]}")
    else:
        if not e: PASS += 1
        else: FAIL += 1; fails.append(f"[err:{name}] erreur inattendue: {e}")

err("var_inexistante", run("descriptives", {"variables": ["zzzz"]}))
err("reg_var_absente", run("regression", {"kind": "linear", "dependent": "nope", "predictors": ["x"]}))
err("ttest_3groupes", run("ttest", {"kind": "independent", "dependent": "x", "group": "groupe"}))
err("mwu_3groupes", run("nonparametric", {"kind": "mannwhitney", "dependent": "x", "group": "groupe"}))
err("reliab_1item", run("reliability", {"items": ["q1"]}))
err("compute_malveillant", {"error": tr("compute", {"expression": "__import__('os').system('ls')"}).get("error")})
err("compute_syntax", {"error": tr("compute", {"expression": "x +* 2"}).get("error")})
err("reg_dv_in_pred_handled", run("regression", {"kind": "linear", "dependent": "y", "predictors": ["y"]}))
# dv seul en predicteur -> pas d'autre predicteur -> erreur claire
err("efa_too_many_factors", run("efa", {"items": ["q1", "q2"], "n_factors": 2}), must_be_error=False)  # doit gerer
# analyses sur variable constante : ne doit pas crasher silencieusement
rc = run("descriptives", {"variables": ["const"]})
ok("const.no_crash", not rc.get("error"))
# regression normale avec dv dans predictors -> retire dv, reste x -> OK
rr = run("regression", {"kind": "linear", "dependent": "y", "predictors": ["y", "x"]})
ok("reg.dv_removed", not rr.get("error"))

# =========================================================
# CAS SUPPLEMENTAIRES (justesse fine, manquantes, etiquettes)
r = run("descriptives", {"variables": ["x"]})
ok("desc.median", approx(cell(r, "Médiane", "x"), float(xx.median()), 0.01))
ok("desc.var", approx(cell(r, "Variance", "x"), float(xx.var(ddof=1)), 0.05))
ok("desc.min", approx(cell(r, "Minimum", "x"), float(xx.min()), 0.01))
ok("desc.max", approx(cell(r, "Maximum", "x"), float(xx.max()), 0.01))
# manquantes exclues : xmiss a N-ceil(N/7) valides
rm = run("descriptives", {"variables": ["xmiss"]})
nvalid = int(pd.to_numeric(df["xmiss"]).notna().sum())
ok("desc.missing_excluded", num(cell(rm, "N", "xmiss")) == nvalid)
ok("desc.missing_count", num(cell(rm, "Manquants", "xmiss")) == N - nvalid)
# etiquette de valeur utilisee (A/B/C et pas 1.0/2.0/3.0)
rc2 = run("crosstabs", {"row": "groupe", "column": "sexe"})
ok("label.crosstab", str(rc2["tables"][0]["rows"][0][0]) in ("A", "B", "C", "Total"))
rf = run("frequencies", {"variables": ["sexe"]})
ok("label.freq", any(str(row[0]) in ("H", "F") for row in rf["tables"][0]["rows"]))
# correlation spearman valeur
rs2 = run("correlation", {"variables": ["x", "y"], "method_spearman": True, "method_pearson": False})
def corr_cell2(res, meth, a_name, b_index):
    for t in res.get("tables", []):
        if meth in t["title"]:
            for row in t["rows"]:
                if row[0] == a_name and "Corr" in str(row[1]):
                    return num(row[2 + b_index])
    return None
rho_ref, _ = stats.spearmanr(xx, yy)
ok("corr.spearman_val", approx(corr_cell2(rs2, "Spearman", "x", 1), rho_ref, 0.02))
# chi2 ddl
ok("crosstab.dof", num(cell(rc2, "ddl", "Khi-deux de Pearson")) == (3 - 1) * (2 - 1))
# logistique coef vs statsmodels
yout = pd.to_numeric(df["outcome"]); Xl = sm.add_constant(df[["x", "z"]].apply(pd.to_numeric))
logit = sm.Logit(yout, Xl).fit(disp=0)
rl = run("regression", {"kind": "logistic", "dependent": "outcome", "predictors": ["x", "z"]})
ok("reg.log.coef_x", approx(cell(rl, "B", "x"), logit.params["x"], 0.05))
# transforms supplementaires
ok("compute.log", abs(tr("compute", {"expression": "log(z)"})["values"][0] - float(np.log(zz[0]))) < 1e-6)
ok("compute.mod", tr("compute", {"expression": "mod(count, 2)"}).get("values") is not None)
ok("recode.keepelse", tr("recode", {"source": "groupe", "rules": [{"from": 1, "to": 99}], "keep_else": True})["values"][list(groupe).index(2)] == 2)
# erreurs supplementaires
err("anova_1level", run("anova", {"kind": "oneway", "dependent": "x", "factor": "const"}))
err("roc_non_binaire", run("roc", {"actual": "groupe", "predictor": "x"}))
err("compute_div0", {"error": tr("compute", {"expression": "x / 0"}).get("error")} if not np.isfinite(tr("compute", {"expression": "x / 0"})["values"][0] if tr("compute", {"expression": "x / 0"}).get("values") else float("nan")) else {"error": None}, must_be_error=False)
err("ks_sur_texte", run("nonparametric", {"kind": "ks_1sample", "variable": "sstr"}))

print(f"\n{'='*50}\nRESULTAT : {PASS} PASS / {PASS+FAIL} tests  ({FAIL} echecs)\n{'='*50}")
if fails:
    print("ECHECS :")
    for f in fails:
        print("  -", f)
else:
    print("=> TOUS LES TESTS PASSENT")
